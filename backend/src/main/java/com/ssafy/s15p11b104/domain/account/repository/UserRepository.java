package com.ssafy.s15p11b104.domain.account.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.account.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

	boolean existsByLoginId(String loginId);

	Optional<User> findByLoginIdAndWithdrawnAtIsNull(String loginId);
}
