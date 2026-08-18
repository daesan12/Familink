package com.ssafy.s15p11b104.domain.call.config;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("local & ai-call-dev")
public class AiCallDevDataInitializer implements ApplicationRunner {

	private final JdbcTemplate jdbcTemplate;

	public AiCallDevDataInitializer(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments arguments) {
		insertUsers();
		insertGroup();
		insertMembers();
		insertAliases();
		insertInterests();
		insertPosts();
		insertRecentCallReport();
	}

	private void insertUsers() {
		jdbcTemplate.execute("""
			insert into users (login_id, password_hash, name, birth_date, gender)
			values
				('demoaicare', 'dev-only', '데모 피보호자', date '1952-04-18', 'MALE'),
				('demoaiguardian1', 'dev-only', '데모 보호자 일', date '1980-06-12', 'FEMALE'),
				('demoaiguardian2', 'dev-only', '데모 보호자 이', date '2002-11-03', 'MALE')
			on conflict (login_id) do nothing
			""");
	}

	private void insertGroup() {
		jdbcTemplate.execute("""
			insert into family_groups (name, invite_code)
			values ('데모 AI 가족', 'DEMOAI')
			on conflict (invite_code) do nothing
			""");
	}

	private void insertMembers() {
		jdbcTemplate.execute("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at)
			select family.id, user_account.id, values_to_insert.role::group_role,
				values_to_insert.is_manager, current_timestamp
			from family_groups family
			cross join (
				values
					('demoaicare', 'CARE_RECEIVER', false),
					('demoaiguardian1', 'GUARDIAN', true),
					('demoaiguardian2', 'GUARDIAN', false)
			) as values_to_insert(login_id, role, is_manager)
			join users user_account on user_account.login_id = values_to_insert.login_id
			where family.invite_code = 'DEMOAI'
			on conflict (group_id, user_id) do nothing
			""");
	}

	private void insertAliases() {
		jdbcTemplate.execute("""
			insert into member_aliases (group_id, owner_member_id, target_member_id, alias)
			select family.id, owner.id, target.id, values_to_insert.alias
			from family_groups family
			join group_members owner on owner.group_id = family.id
			join users owner_user on owner_user.id = owner.user_id and owner_user.login_id = 'demoaicare'
			cross join (
				values
					('demoaiguardian1', '딸'),
					('demoaiguardian2', '손자')
			) as values_to_insert(login_id, alias)
			join users target_user on target_user.login_id = values_to_insert.login_id
			join group_members target on target.group_id = family.id and target.user_id = target_user.id
			where family.invite_code = 'DEMOAI'
			on conflict (group_id, owner_member_id, target_member_id) do update
			set alias = excluded.alias,
				updated_at = current_timestamp
			where member_aliases.alias is distinct from excluded.alias
			""");
	}

	private void insertInterests() {
		jdbcTemplate.execute("""
			insert into member_interests (care_receiver_member_id, interest_text)
			select member.id, values_to_insert.interest
			from group_members member
			join users user_account on user_account.id = member.user_id
			cross join (values ('산책'), ('야구')) as values_to_insert(interest)
			where user_account.login_id = 'demoaicare'
			on conflict (care_receiver_member_id, interest_text) do nothing
			""");
	}

	private void insertPosts() {
		insertPost(
			"demoaiguardian1",
			"오늘 점심에 된장국을 맛있게 먹었어요.",
			"데모 보호자 일이 오늘 점심으로 된장국을 먹었다는 소식을 전했습니다."
		);
		insertPost(
			"demoaiguardian2",
			"주말 야구 경기에서 응원하는 팀이 이겼어요!",
			"데모 보호자 이가 주말 야구 경기에서 응원하는 팀이 이겨 기뻤다고 전했습니다."
		);
	}

	private void insertPost(String authorLoginId, String content, String summary) {
		jdbcTemplate.update("""
			with inserted_post as (
				insert into posts (group_id, author_member_id, content)
				select family.id, author.id, ?
				from family_groups family
				join group_members author on author.group_id = family.id
				join users author_user on author_user.id = author.user_id
				where family.invite_code = 'DEMOAI'
					and author_user.login_id = ?
					and not exists (
						select 1
						from posts existing
						where existing.group_id = family.id and existing.content = ?
					)
				returning id
			)
			insert into post_analyses (post_id, status, summary, analyzed_at)
			select id, 'SUCCESS', ?, current_timestamp
			from inserted_post
			""", content, authorLoginId, content, summary);

		jdbcTemplate.update("""
			update posts fixture_post
			set created_at = current_timestamp,
				updated_at = current_timestamp
			from family_groups family
			join group_members author on author.group_id = family.id
			join users author_user on author_user.id = author.user_id
			where fixture_post.group_id = family.id
				and fixture_post.author_member_id = author.id
				and family.invite_code = 'DEMOAI'
				and author_user.login_id = ?
				and fixture_post.content = ?
			""", authorLoginId, content);
	}

	private void insertRecentCallReport() {
		List<Long> callSessionIds = jdbcTemplate.queryForList("""
			with care_receiver as (
				select member.id as member_id, member.group_id
				from group_members member
				join users user_account on user_account.id = member.user_id
				where user_account.login_id = 'demoaicare' and member.left_at is null
			)
			insert into call_sessions (
				group_id, care_receiver_member_id, persona_id, status,
				created_at, started_at, ended_at,
				transcript_integrity_status, transcript_finalized_at
			)
			select group_id, member_id, 5, 'COMPLETED',
				current_timestamp - interval '1 day 10 minutes',
				current_timestamp - interval '1 day 10 minutes',
				current_timestamp - interval '1 day',
				'COMPLETE', current_timestamp - interval '1 day'
			from care_receiver
			where not exists (
				select 1
				from call_reports report
				join call_sessions session on session.id = report.call_session_id
				where session.care_receiver_member_id = care_receiver.member_id
			)
			returning id
			""", Long.class);
		if (callSessionIds.isEmpty()) {
			return;
		}

		jdbcTemplate.update("""
			insert into call_reports (
				call_session_id, summary, emotion_category, emotion_subcategory, guardian_message
			)
			values (?, '산책과 야구 이야기를 나누며 편안하게 통화를 마쳤습니다.',
				'NEUTRAL', '편안함', null)
			""", callSessionIds.get(0));
	}
}
