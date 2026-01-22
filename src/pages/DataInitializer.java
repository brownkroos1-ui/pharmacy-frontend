package com.pharmacy.config;

import com.pharmacy.model.User;
import com.pharmacy.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Skip if already exists
            if (!userRepository.existsByUsername("admin")) {
                User admin = new User();
                admin.setUsername("admin");
                // Encode password
                admin.setPassword(passwordEncoder.encode("admin123"));
                admin.setRole("ADMIN");
                
                userRepository.save(admin);
                System.out.println("Default ADMIN user created successfully.");
            }
        };
    }
}