package com.ssafy.s15p11b104.domain.group.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;

public interface FamilyGroupRepository extends JpaRepository<FamilyGroup, Long> {

	boolean existsByInviteCode(String inviteCode);

	Optional<FamilyGroup> findByInviteCode(String inviteCode);

	/**
	 * 그룹 범위를 바꾸는 트랜잭션끼리 배타가 되도록 그룹 행을 잠근다. 존재하면 그룹 id를 돌려준다.
	 *
	 * <p>그룹 삭제는 활성 인원을 확인한 뒤 그룹 범위 데이터를 일괄 삭제하고, 가입 요청 생성·결정은
	 * 그 그룹에 행을 추가한다. 세 경로가 이 행에서 만나 직렬화되지 않으면 삭제의 인원 확인 뒤에
	 * 커밋된 승인이 만든 구성원까지 함께 지워진다.
	 *
	 * <p>{@code FOR UPDATE}가 아니라 {@code FOR NO KEY UPDATE}를 쓴다. 두 모드는 서로 충돌하므로
	 * 위 세 경로를 배타로 만드는 목적은 그대로 달성한다. 반면 {@code FOR UPDATE}는 외래 키 검사가
	 * 거는 {@code FOR KEY SHARE}까지 막는다. 그룹을 참조하는 INSERT는 거의 모든 쓰기 경로에 있고,
	 * 그 경로들은 자기 aggregate 행을 먼저 잠근 뒤 INSERT하므로 잠금 순서가 정반대가 되어 교착이
	 * 생긴다. 예를 들어 일정 수정은 {@code calendar_events} 행을 잡은 뒤 알림을 저장하면서
	 * {@code family_groups}를 요구하고, 그룹 삭제는 그 반대다. 그룹을 참조하는 쓰기를 막을 이유는
	 * 없으므로 필요한 만큼만 잠근다.
	 *
	 * <p>JPA 잠금 모드에는 {@code FOR NO KEY UPDATE}가 없어 네이티브 쿼리로 지정한다.
	 */
	@Query(value = """
		select id
		from family_groups
		where id = :groupId
		for no key update
		""", nativeQuery = true)
	Optional<Long> lockForGroupScopeChange(@Param("groupId") Long groupId);
}
