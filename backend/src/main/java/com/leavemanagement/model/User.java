package com.leavemanagement.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true, nullable = false)
    private String email;
    
    @JsonIgnore // don't serialize password
    private String password;

    private String department;
    private String designation;
    private String employeeType;
    private java.time.LocalDate hireDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    @JsonIgnore // Prevent infinite recursion when serializing
    private User manager;

    @OneToMany(mappedBy = "manager")
    @JsonIgnore // Prevent infinite recursion
    private List<User> directReports = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<UserRole> roles = new ArrayList<>();
}
