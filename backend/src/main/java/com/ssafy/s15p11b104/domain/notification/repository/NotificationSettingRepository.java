package com.ssafy.s15p11b104.domain.notification.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.notification.entity.NotificationSetting;

public interface NotificationSettingRepository extends JpaRepository<NotificationSetting, Long> {

	List<NotificationSetting> findAllByUser_Id(Long userId);
}
