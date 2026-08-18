import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const migrationDir = path.join(repoRoot, 'backend/src/main/resources/db/migration');

const migrationFiles = fs.readdirSync(migrationDir)
  .filter((name) => /^V\d+__.+\.sql$/.test(name))
  .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]));

const tables = new Map();

function splitTopLevel(value) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === '(') {
      depth += 1;
      current += char;
    } else if (char === ')') {
      depth -= 1;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function normalizeType(definition) {
  return definition
    .replace(/\s+GENERATED\s+BY\s+DEFAULT\s+AS\s+IDENTITY/gi, '')
    .replace(/\s+DEFAULT\s+[^\s,]+/gi, '')
    .replace(/\s+NOT\s+NULL/gi, '')
    .replace(/\s+PRIMARY\s+KEY/gi, '')
    .replace(/\s+UNIQUE/gi, '')
    .replace(/\s+REFERENCES\s+[a-z_]+\s*\([^)]*\)(?:\s+ON\s+DELETE\s+(?:SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION|CASCADE|RESTRICT))?/gi, '')
    .trim();
}

function parseColumn(segment) {
  const match = segment.match(/^([a-z_][a-z0-9_]*)\s+([\s\S]+)$/i);
  if (!match) return null;
  const [, name, definition] = match;
  if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)$/i.test(name)) return null;
  const reference = definition.match(/REFERENCES\s+([a-z_]+)\s*\(([^)]+)\)/i);
  return {
    name,
    type: normalizeType(definition),
    pk: /PRIMARY\s+KEY/i.test(definition),
    uq: /\bUNIQUE\b/i.test(definition),
    nullable: !/NOT\s+NULL/i.test(definition) && !/PRIMARY\s+KEY/i.test(definition),
    reference: reference ? { table: reference[1], column: reference[2].trim() } : null,
  };
}

function applyUniqueConstraints(table, body) {
  const uniqueRegex = /(?:CONSTRAINT\s+[a-z0-9_]+\s+)?UNIQUE\s*\(([^)]+)\)/gi;
  for (const match of body.matchAll(uniqueRegex)) {
    const names = match[1].split(',').map((item) => item.trim());
    if (names.length === 1) {
      const column = table.columns.find((item) => item.name === names[0]);
      if (column) column.uq = true;
    } else {
      table.uniqueConstraints.push(names);
    }
  }
}

for (const filename of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationDir, filename), 'utf8');
  const createRegex = /CREATE TABLE\s+([a-z_]+)\s*\(([\s\S]*?)\);/gi;
  for (const match of sql.matchAll(createRegex)) {
    const [, name, body] = match;
    const table = {
      name,
      columns: splitTopLevel(body).map(parseColumn).filter(Boolean),
      uniqueConstraints: [],
      uniqueIndexes: [],
    };
    applyUniqueConstraints(table, body);
    tables.set(name, table);
  }
}

for (const filename of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationDir, filename), 'utf8');
  const alterRegex = /ALTER TABLE\s+([a-z_]+)\s+([\s\S]*?);/gi;
  for (const match of sql.matchAll(alterRegex)) {
    const [, tableName, body] = match;
    const table = tables.get(tableName);
    if (!table) continue;
    for (const operation of splitTopLevel(body)) {
      const add = operation.match(/^ADD COLUMN\s+([a-z_][a-z0-9_]*)\s+([\s\S]+)$/i);
      if (add) {
        const column = parseColumn(`${add[1]} ${add[2]}`);
        if (column && !table.columns.some((item) => item.name === column.name)) table.columns.push(column);
        continue;
      }
      const drop = operation.match(/^DROP COLUMN\s+([a-z_][a-z0-9_]*)/i);
      if (drop) {
        table.columns = table.columns.filter((item) => item.name !== drop[1]);
        continue;
      }
      const changeType = operation.match(/^ALTER COLUMN\s+([a-z_][a-z0-9_]*)\s+TYPE\s+([^\s,]+(?:\([^)]+\))?)/i);
      if (changeType) {
        const column = table.columns.find((item) => item.name === changeType[1]);
        if (column) column.type = changeType[2];
        continue;
      }
      const setNotNull = operation.match(/^ALTER COLUMN\s+([a-z_][a-z0-9_]*)\s+SET NOT NULL/i);
      if (setNotNull) {
        const column = table.columns.find((item) => item.name === setNotNull[1]);
        if (column) column.nullable = false;
        continue;
      }
      const dropNotNull = operation.match(/^ALTER COLUMN\s+([a-z_][a-z0-9_]*)\s+DROP NOT NULL/i);
      if (dropNotNull) {
        const column = table.columns.find((item) => item.name === dropNotNull[1]);
        if (column) column.nullable = true;
      }
    }
  }
}

const uniqueIndexes = new Map();
for (const filename of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationDir, filename), 'utf8');
  const indexRegex = /CREATE UNIQUE INDEX\s+([a-z0-9_]+)\s+ON\s+([a-z_]+)\s*\(([^)]+)\)\s*([\s\S]*?);/gi;
  for (const match of sql.matchAll(indexRegex)) {
    const [, name, tableName, rawColumns, tail] = match;
    uniqueIndexes.set(name, {
      name,
      tableName,
      columns: rawColumns.split(',').map((item) => item.trim()),
      partial: /\bWHERE\b/i.test(tail),
      nullsNotDistinct: /NULLS NOT DISTINCT/i.test(tail),
    });
  }
}

for (const index of uniqueIndexes.values()) {
  const table = tables.get(index.tableName);
  if (table) table.uniqueIndexes.push(index);
}

const calendarEndDate = tables.get('calendar_events')?.columns.find((column) => column.name === 'end_date');
const groupMemberPair = tables.get('group_members')?.uniqueConstraints
  .some((columns) => columns.join(',') === 'group_id,user_id');
if (!calendarEndDate || calendarEndDate.nullable || !groupMemberPair) {
  throw new Error('Migration semantics validation failed for NOT NULL or composite UNIQUE');
}
if ([...tables.values()].some((table) => table.columns.some((column) => /\bNULL\b/i.test(column.type)))) {
  throw new Error('A parsed column type still contains an ON DELETE NULL token');
}

const groups = [
  {
    title: 'Account · Group',
    color: '#7764D6',
    fill: '#F4F0FF',
    tables: ['users', 'family_groups', 'group_members', 'group_join_requests', 'member_aliases', 'member_interests'],
  },
  {
    title: 'Feed · Media',
    color: '#D679A2',
    fill: '#FFF1F7',
    tables: ['posts', 'post_media', 'comments', 'post_reactions', 'post_analyses'],
  },
  {
    title: 'Calendar · Engagement',
    color: '#B58A3C',
    fill: '#FFF8E8',
    tables: ['calendar_events', 'event_participants', 'carnations'],
  },
  {
    title: 'Call · Report',
    color: '#4D83B8',
    fill: '#EDF7FF',
    tables: [
      'call_sessions',
      'call_transcripts',
      'call_transcript_events',
      'call_report_generation_requests',
      'call_reports',
      'daily_report_generation_claims',
      'daily_reports',
    ],
  },
  {
    title: 'Notification',
    color: '#4D9A77',
    fill: '#EEFAF4',
    tables: ['notifications', 'notification_settings', 'device_tokens'],
  },
];

const missing = groups.flatMap((group) => group.tables).filter((name) => !tables.has(name));
if (missing.length || groups.flatMap((group) => group.tables).length !== tables.size) {
  throw new Error(`ERD grouping mismatch. missing=${missing.join(',')} parsed=${tables.size}`);
}

const canvasWidth = 2200;
const columnWidth = 400;
const columnGap = 28;
const left = 35;
const top = 155;
const headerHeight = 40;
const lineHeight = 19;
const cardGap = 24;
const cardPadding = 14;
const positions = new Map();
let maxY = 0;

for (const [groupIndex, group] of groups.entries()) {
  let y = top + 58;
  const x = left + groupIndex * (columnWidth + columnGap);
  for (const tableName of group.tables) {
    const table = tables.get(tableName);
    const constraintCount = table.uniqueConstraints.length + table.uniqueIndexes.length;
    const constraintHeight = constraintCount ? 12 + constraintCount * lineHeight : 0;
    const height = headerHeight + cardPadding * 2 + table.columns.length * lineHeight + constraintHeight;
    positions.set(tableName, { x, y, width: columnWidth, height, group });
    y += height + cardGap;
  }
  maxY = Math.max(maxY, y);
}

const canvasHeight = maxY + 120;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function keyLabel(column) {
  const keys = [];
  if (column.pk) keys.push('PK');
  if (column.reference) keys.push('FK');
  if (column.uq) keys.push('UQ');
  return keys.join('·') || '  ';
}

function relationPath(source, target, index) {
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const sourceX = sourceCenterX < targetCenterX ? source.x + source.width : source.x;
  const targetX = sourceCenterX < targetCenterX ? target.x : target.x + target.width;
  const sourceY = source.y + 28 + (index % Math.max(1, Math.floor((source.height - 40) / 20))) * 8;
  const targetY = target.y + 28;
  const bend = Math.max(40, Math.abs(targetX - sourceX) * 0.42);
  const control1 = sourceX < targetX ? sourceX + bend : sourceX - bend;
  const control2 = sourceX < targetX ? targetX - bend : targetX + bend;
  return `M ${sourceX} ${sourceY} C ${control1} ${sourceY}, ${control2} ${targetY}, ${targetX} ${targetY}`;
}

const relations = [];
for (const table of tables.values()) {
  table.columns.forEach((column, index) => {
    if (column.reference && positions.has(column.reference.table)) {
      relations.push({ source: table.name, target: column.reference.table, column: column.name, index });
    }
  });
}

const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-labelledby="title desc">`);
svg.push('<title id="title">Familink 최종 데이터 모델 ERD</title>');
svg.push(`<desc id="desc">Flyway V1부터 V12까지 파싱해 생성한 ${tables.size}개 테이블과 외래 키 관계</desc>`);
svg.push(`<defs>
  <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFBFF"/><stop offset="1" stop-color="#F7F4FF"/></linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#4F3D7D" flood-opacity="0.10"/></filter>
  <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9C91C7"/></marker>
  <style>
    text { font-family: Pretendard, "Noto Sans KR", "Segoe UI", sans-serif; fill: #29243A; }
    .title { font-size: 34px; font-weight: 800; }
    .subtitle { font-size: 15px; fill: #716985; }
    .group { font-size: 18px; font-weight: 800; }
    .table { font-size: 15px; font-weight: 800; fill: #FFFFFF; }
    .field { font-family: "Cascadia Mono", Consolas, monospace; font-size: 11px; }
      .key { font-family: "Cascadia Mono", Consolas, monospace; font-size: 10px; font-weight: 800; }
      .constraint { font-family: "Cascadia Mono", Consolas, monospace; font-size: 10px; fill: #6F687E; }
    .relation { fill: none; stroke: #9C91C7; stroke-width: 1.35; stroke-opacity: .42; marker-end: url(#arrow); }
  </style>
</defs>`);
svg.push(`<rect width="${canvasWidth}" height="${canvasHeight}" rx="28" fill="url(#background)"/>`);
svg.push('<rect x="0" y="0" width="2200" height="9" rx="4" fill="#7764D6"/>');
svg.push('<text x="48" y="58" class="title">Familink Data Model</text>');
svg.push(`<text x="48" y="88" class="subtitle">Final schema · Flyway V1–V12 · ${tables.size} tables · ${relations.length} foreign-key relations</text>`);
svg.push('<text x="2150" y="58" text-anchor="end" class="subtitle">PK primary key · FK foreign key · UQ unique</text>');

for (const [index, group] of groups.entries()) {
  const x = left + index * (columnWidth + columnGap);
  svg.push(`<rect x="${x}" y="${top}" width="${columnWidth}" height="42" rx="14" fill="${group.fill}" stroke="${group.color}" stroke-width="1.5"/>`);
  svg.push(`<circle cx="${x + 22}" cy="${top + 21}" r="7" fill="${group.color}"/>`);
  svg.push(`<text x="${x + 39}" y="${top + 27}" class="group" fill="${group.color}">${escapeXml(group.title)}</text>`);
}

for (const relation of relations) {
  const source = positions.get(relation.source);
  const target = positions.get(relation.target);
  svg.push(`<path d="${relationPath(source, target, relation.index)}" class="relation"/>`);
}

for (const table of tables.values()) {
  const position = positions.get(table.name);
  const { x, y, width, height, group } = position;
  svg.push(`<g filter="url(#shadow)">`);
  svg.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="#FFFFFF" stroke="${group.color}" stroke-width="1.4"/>`);
  svg.push(`<path d="M ${x + 14} ${y} H ${x + width - 14} Q ${x + width} ${y} ${x + width} ${y + 14} V ${y + headerHeight} H ${x} V ${y + 14} Q ${x} ${y} ${x + 14} ${y}" fill="${group.color}"/>`);
  svg.push(`<text x="${x + 15}" y="${y + 26}" class="table">${escapeXml(table.name)}</text>`);
  svg.push(`</g>`);
  table.columns.forEach((column, index) => {
    const lineY = y + headerHeight + cardPadding + 12 + index * lineHeight;
    const key = keyLabel(column);
    const nullable = column.nullable ? '?' : '';
    const type = column.type.length > 24 ? `${column.type.slice(0, 23)}…` : column.type;
    svg.push(`<text x="${x + 14}" y="${lineY}" class="key" fill="${group.color}">${escapeXml(key.padEnd(5))}</text>`);
    svg.push(`<text x="${x + 62}" y="${lineY}" class="field">${escapeXml(column.name)}</text>`);
    svg.push(`<text x="${x + width - 14}" y="${lineY}" class="field" text-anchor="end" fill="#726A80">${escapeXml(type)}${nullable}</text>`);
  });
  const constraintLines = [
    ...table.uniqueConstraints.map((columns) => `UQ (${columns.join(', ')})`),
    ...table.uniqueIndexes.map((index) => `UIX (${index.columns.join(', ')})${index.partial ? ' · partial' : ''}${index.nullsNotDistinct ? ' · nulls-equal' : ''}`),
  ];
  if (constraintLines.length) {
    const separatorY = y + headerHeight + cardPadding + table.columns.length * lineHeight + 7;
    svg.push(`<line x1="${x + 14}" y1="${separatorY}" x2="${x + width - 14}" y2="${separatorY}" stroke="#E8E4F0"/>`);
    constraintLines.forEach((line, index) => {
      const value = line.length > 50 ? `${line.slice(0, 49)}…` : line;
      svg.push(`<text x="${x + 14}" y="${separatorY + 15 + index * lineHeight}" class="constraint">${escapeXml(value)}</text>`);
    });
  }
}

svg.push(`<text x="48" y="${canvasHeight - 48}" class="subtitle">Generated from backend/src/main/resources/db/migration · audit and reliability columns included</text>`);
svg.push('</svg>');

fs.writeFileSync(path.join(here, 'familink-erd.svg'), svg.join('\n'), 'utf8');
console.log(`Generated familink-erd.svg: ${tables.size} tables, ${relations.length} relations, ${canvasWidth}x${canvasHeight}`);
