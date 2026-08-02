package com.ssafy.s15p11b104.domain.account.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.account.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

	boolean existsByLoginId(String loginId);

	Optional<User> findByLoginIdAndWithdrawnAtIsNull(String loginId);

	Optional<User> findByIdAndWithdrawnAtIsNull(Long id);

	/**
	 * 활성 계정 행을 잠근다. 활성이면 계정 id를 돌려준다.
	 *
	 * <p>{@code FOR UPDATE}가 아니라 {@code FOR NO KEY UPDATE}를 쓴다. 두 모드는 서로 충돌하므로
	 * 계정 행을 잠그는 경로끼리 배타로 만드는 목적은 그대로 달성한다. 반면 {@code FOR UPDATE}는
	 * 외래 키 검사가 거는 {@code FOR KEY SHARE}까지 막는다. {@code users}를 참조하는 INSERT는
	 * 거의 모든 쓰기 경로에 있고, 특히 알림 행은 수신자와 행위자 두 방향으로 계정을 참조한다.
	 * 계정 행을 {@code FOR UPDATE}로 잡으면 같은 그룹의 두 작성 요청이 서로의 계정 행을 반대
	 * 순서로 요구해 교착이 된다. 계정을 참조하는 쓰기를 막을 이유는 없으므로 필요한 만큼만 잠근다.
	 *
	 * <p>JPA 잠금 모드에는 {@code FOR NO KEY UPDATE}가 없어 네이티브 쿼리로 지정한다.
	 */
	@Query(value = """
		select id
		from users
		where id = :id
		  and withdrawn_at is null
		for no key update
		""", nativeQuery = true)
	Optional<Long> lockActiveById(@Param("id") Long id);

	/**
	 * 활성 계정 행을 잠그고 엔티티로 가져온다.
	 *
	 * <p>잠금은 {@link #lockActiveById(Long)}가 수행하고, 여기서는 잠근 행을 엔티티로 다시 읽기만
	 * 한다. 두 조회 모두 같은 트랜잭션 안에서 실행되므로 그 사이에 다른 트랜잭션이 끼어들 수 없다.
	 */
	default Optional<User> findActiveByIdForUpdate(Long id) {
		return lockActiveById(id).flatMap(this::findById);
	}
}
