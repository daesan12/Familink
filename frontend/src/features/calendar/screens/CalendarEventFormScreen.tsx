import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import { useHardwareBack } from "../../../shared/hooks/useHardwareBack";
import { CachedRemoteImage } from "../../../shared/media/CachedRemoteImage";
import {
  createCalendarEventDraft,
  createCalendarEventDraftFromDetail,
  disableCalendarEventTime,
  enableCalendarEventTime,
  hasCalendarEventDraftErrors,
  toCalendarEventWriteInput,
  validateCalendarEventDraft,
  type CalendarEventDraft,
  type CalendarEventDraftErrors,
} from "../calendarFormModel";
import { CalendarParticipantModal } from "../components/CalendarParticipantModal";
import { toErrorMessage } from "../hooks/useCalendarData";
import type {
  CalendarEventDetail,
  CalendarGateway,
  CalendarMember,
  DateKey,
} from "../types";

const PROFILE_PLACEHOLDER = require("../../../assets/images/profile-placeholder.png");
const KST_OFFSET_IN_MS = 9 * 60 * 60 * 1000;

type PickerField = "startDate" | "startTime" | "endDate" | "endTime";

interface CalendarEventFormScreenProps {
  currentMember: CalendarMember | null;
  currentUserName: string;
  gateway: CalendarGateway;
  groupId: string;
  initialDate: DateKey;
  initialDetail?: CalendarEventDetail;
  members: readonly CalendarMember[];
  now?: Date;
  onCancel: () => void;
  onSaved: (eventId: string) => void;
}

export function CalendarEventFormScreen({
  currentMember,
  currentUserName,
  gateway,
  groupId,
  initialDate,
  initialDetail,
  members,
  now,
  onCancel,
  onSaved,
}: CalendarEventFormScreenProps) {
  const [draft, setDraft] = useState<CalendarEventDraft>(() =>
    initialDetail
      ? createCalendarEventDraftFromDetail(initialDetail)
      : createCalendarEventDraft(initialDate)
  );
  const [errors, setErrors] = useState<CalendarEventDraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [participantsVisible, setParticipantsVisible] = useState(false);

  useHardwareBack(() => {
    if (saving) {
      return true;
    }
    onCancel();
    return true;
  });
  const openPicker = (field: PickerField) => {
    const isDate = field.endsWith("Date");
    const dateKey = field.startsWith("start") ? draft.startDate : draft.endDate;
    const time = field.startsWith("start") ? draft.startTime : draft.endTime;
    DateTimePickerAndroid.open({
      is24Hour: true,
      mode: isDate ? "date" : "time",
      onChange: (event, value) => {
        if (event.type !== "set" || !value) {
          return;
        }
        if (isDate) {
          const nextDate = formatPickerDate(value);
          setDraft((current) => {
            if (field === "startDate") {
              return {
                ...current,
                endDate:
                  current.endDate < nextDate ? nextDate : current.endDate,
                startDate: nextDate,
              };
            }
            return { ...current, endDate: nextDate };
          });
        } else {
          const nextTime = formatPickerTime(value);
          setDraft((current) => ({ ...current, [field]: nextTime }));
        }
        setErrors({});
      },
      timeZoneName: "Asia/Seoul",
      value: pickerValue(dateKey, time),
    });
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    const nextErrors = validateCalendarEventDraft(draft);
    setErrors(nextErrors);
    setSaveError(null);
    if (hasCalendarEventDraftErrors(nextErrors)) {
      return;
    }
    setSaving(true);
    try {
      const input = toCalendarEventWriteInput(draft);
      if (initialDetail) {
        await gateway.updateEvent(initialDetail.id, input);
        onSaved(initialDetail.id);
      } else {
        onSaved(await gateway.createEvent(groupId, input));
      }
    } catch (error) {
      setSaveError(toErrorMessage(error));
      setSaving(false);
    }
  };

  const authorName = currentMember?.displayName ?? currentUserName;
  const memberById = new Map(
    members.map((member) => [member.memberId, member])
  );

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="일정 작성 취소"
          accessibilityRole="button"
          disabled={saving}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="arrow-left"
            size={25}
          />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {initialDetail ? "일정 수정" : "새 일정"}
        </Text>
        <Pressable
          accessibilityLabel="일정 저장"
          accessibilityRole="button"
          disabled={saving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.purpleDeep} size="small" />
          ) : (
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="check"
              size={27}
            />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <TextInput
            accessibilityLabel="일정 제목"
            maxLength={20}
            onChangeText={(title) => {
              setDraft((current) => ({ ...current, title }));
              setErrors((current) => ({ ...current, title: undefined }));
            }}
            placeholder="일정 제목"
            placeholderTextColor={COLORS.textSubtle}
            style={styles.titleInput}
            value={draft.title}
          />
          <Text style={styles.counter}>{draft.title.length}/20</Text>
          {errors.title ? <ErrorText message={errors.title} /> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.timeSettingRow}>
            <View style={styles.timeSettingIcon}>
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="clock-outline"
                size={21}
              />
            </View>
            <View style={styles.timeSettingCopy}>
              <Text style={styles.label}>시간 설정</Text>
              <Text style={styles.timeSettingDescription}>
                {draft.timeEnabled
                  ? "시작과 종료 시간을 직접 정해요."
                  : "하루 종일 일정으로 저장돼요."}
              </Text>
            </View>
            <Switch
              accessibilityLabel="시간 설정"
              onValueChange={(enabled) => {
                setDraft((current) =>
                  enabled
                    ? enableCalendarEventTime(current, now)
                    : disableCalendarEventTime(current)
                );
                setErrors({});
              }}
              thumbColor={COLORS.background}
              trackColor={{ false: COLORS.inactive, true: COLORS.purple }}
              value={draft.timeEnabled}
            />
          </View>
          <View style={styles.scheduleSurface}>
            <ScheduleRow
              date={draft.startDate}
              label="시작"
              onPressDate={() => openPicker("startDate")}
              onPressTime={() => openPicker("startTime")}
              showTime={draft.timeEnabled}
              time={draft.startTime}
            />
            <View style={styles.divider} />
            <ScheduleRow
              date={draft.endDate}
              label="종료"
              onPressDate={() => openPicker("endDate")}
              onPressTime={() => openPicker("endTime")}
              showTime={draft.timeEnabled}
              time={draft.endTime}
            />
          </View>
          {errors.date ? <ErrorText message={errors.date} /> : null}
          {errors.time ? <ErrorText message={errors.time} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>작성자</Text>
          <PersonChip
            imageUrl={currentMember?.profileImageUrl ?? null}
            name={authorName}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>참여자</Text>
            <Pressable
              accessibilityLabel="참여자 추가"
              accessibilityRole="button"
              onPress={() => setParticipantsVisible(true)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="plus"
                size={22}
              />
            </Pressable>
          </View>
          <View style={styles.chips}>
            {draft.participantMemberIds.length === 0 ? (
              <Text style={styles.emptyText}>참여자를 추가할 수 있어요.</Text>
            ) : (
              draft.participantMemberIds.map((memberId) => {
                const member = memberById.get(memberId);
                return (
                  <View key={memberId} style={styles.removableChip}>
                    <PersonChip
                      imageUrl={member?.profileImageUrl ?? null}
                      name={member?.displayName ?? `구성원 ${memberId}`}
                    />
                    <Pressable
                      accessibilityLabel={`${
                        member?.displayName ?? "참여자"
                      } 삭제`}
                      accessibilityRole="button"
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          participantMemberIds:
                            current.participantMemberIds.filter(
                              (id) => id !== memberId
                            ),
                        }))
                      }
                      style={styles.removeButton}
                    >
                      <MaterialDesignIcons
                        color={COLORS.textMuted}
                        name="close"
                        size={18}
                      />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.card}>
          <TextInput
            accessibilityLabel="일정 세부 내용"
            maxLength={50}
            multiline
            onChangeText={(description) => {
              setDraft((current) => ({ ...current, description }));
              setErrors((current) => ({
                ...current,
                description: undefined,
              }));
            }}
            placeholder="세부 내용"
            placeholderTextColor={COLORS.textSubtle}
            style={styles.descriptionInput}
            textAlignVertical="top"
            value={draft.description}
          />
          <Text style={styles.counter}>{draft.description.length}/50</Text>
          {errors.description ? (
            <ErrorText message={errors.description} />
          ) : null}
        </View>

        {saveError ? (
          <Text accessibilityRole="alert" style={styles.saveError}>
            {saveError}
          </Text>
        ) : null}
      </ScrollView>

      <CalendarParticipantModal
        members={members}
        onChange={(participantMemberIds) =>
          setDraft((current) => ({ ...current, participantMemberIds }))
        }
        onClose={() => setParticipantsVisible(false)}
        selectedMemberIds={draft.participantMemberIds}
        visible={participantsVisible}
      />
    </KeyboardAvoidingView>
  );
}

function ScheduleRow({
  date,
  label,
  onPressDate,
  onPressTime,
  showTime,
  time,
}: {
  date: DateKey;
  label: string;
  onPressDate: () => void;
  onPressTime: () => void;
  showTime: boolean;
  time: string;
}) {
  return (
    <View style={styles.scheduleRow}>
      <View style={styles.scheduleLabelGroup}>
        <View style={styles.scheduleDot} />
        <Text style={styles.scheduleLabel}>{label}</Text>
      </View>
      <View style={styles.scheduleValues}>
        <Pressable
          accessibilityLabel={`${label} 날짜 ${formatDateLabel(date)}`}
          accessibilityRole="button"
          onPress={onPressDate}
          style={({ pressed }) => [
            styles.valueButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.valueText}>{formatDateLabel(date)}</Text>
        </Pressable>
        {showTime ? (
          <Pressable
            accessibilityLabel={`${label} 시간 ${time}`}
            accessibilityRole="button"
            onPress={onPressTime}
            style={({ pressed }) => [
              styles.timeButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.timeValueText}>{time}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PersonChip({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  return (
    <View style={styles.personChip}>
      <CachedRemoteImage
        accessibilityLabel={`${name} 프로필 사진`}
        source={imageUrl ? { uri: imageUrl } : PROFILE_PLACEHOLDER}
        style={styles.avatar}
      />
      <Text numberOfLines={1} style={styles.personName}>
        {name}
      </Text>
    </View>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.fieldError}>
      {message}
    </Text>
  );
}

function pickerValue(date: DateKey, time: string): Date {
  return new Date(`${date}T${time}:00+09:00`);
}

function formatPickerDate(value: Date): DateKey {
  const kstValue = new Date(value.getTime() + KST_OFFSET_IN_MS);
  return `${kstValue.getUTCFullYear()}-${padTwo(
    kstValue.getUTCMonth() + 1
  )}-${padTwo(kstValue.getUTCDate())}`;
}

function formatPickerTime(value: Date): string {
  const kstValue = new Date(value.getTime() + KST_OFFSET_IN_MS);
  return `${padTwo(kstValue.getUTCHours())}:${padTwo(
    kstValue.getUTCMinutes()
  )}`;
}

function formatDateLabel(date: DateKey): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatar: {
    borderRadius: RADII.pill,
    height: 32,
    width: 32,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADII.medium,
    marginBottom: 12,
    padding: 16,
  },
  chips: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  counter: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  descriptionInput: {
    color: COLORS.textStrong,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 92,
    padding: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  divider: {
    backgroundColor: COLORS.divider,
    height: 1,
    marginVertical: 4,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 44,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  header: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingHorizontal: 8,
  },
  headerButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headerTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: "800",
  },
  label: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  personChip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F8F7FF",
    borderColor: COLORS.lavender,
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingRight: 12,
  },
  personName: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: "700",
    maxWidth: 150,
  },
  pressed: {
    opacity: 0.68,
  },
  removableChip: {
    alignItems: "center",
    flexDirection: "row",
  },
  removeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    marginLeft: -6,
    width: 44,
  },
  saveError: {
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  scheduleLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  scheduleDot: {
    backgroundColor: COLORS.purple,
    borderRadius: RADII.pill,
    height: 7,
    width: 7,
  },
  scheduleLabelGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    width: 58,
  },
  scheduleRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 54,
  },
  scheduleSurface: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderRadius: RADII.small,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  scheduleValues: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  screen: {
    backgroundColor: COLORS.surfaceMuted,
    flex: 1,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeSettingCopy: {
    flex: 1,
  },
  timeSettingDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  timeSettingIcon: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  timeSettingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 52,
  },
  timeButton: {
    alignItems: "center",
    backgroundColor: COLORS.purpleDeep,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  timeValueText: {
    color: COLORS.background,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  titleInput: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: "700",
    minHeight: 44,
    padding: 0,
  },
  valueButton: {
    alignItems: "flex-start",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 2,
  },
  valueText: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
});
