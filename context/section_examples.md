section
└─ section_module (section_module.sectionId)
├─ main competence (section_module.mainCompetenceId)
├─ secondary competences (via section_module_secondary_competence)
└─ questions (question.sectionModuleId)
└─ each question also has question.competenceId

competence
├─ primary source (competence.primarySourceId)
├─ secondary sources (via competence_secondary_source)
└─ questions (question.competenceId)

Section: "Cloud Infrastructure"
│
├─ Module: "Networking Basics"
│ ├─ Main competence: "Network Design"
│ │ ├─ Primary source: NTNU – "Computer Networks" (course)
│ │ ├─ Secondary sources: MIT OCW – "Networking 101"
│ │ └─ Questions (competenceId = Network Design):
│ │ Q1 "What does a subnet mask do?"
│ │ Q2 "Design a VPC for 3 tiers"
│ ├─ Secondary competence: "Security Fundamentals"
│ │ ├─ Primary source: Coursera – "Intro to Cybersecurity"
│ │ └─ Questions (competenceId = Security Fundamentals):
│ │ Q3 "Explain least privilege"
│ └─ All questions in this module: Q1, Q2, Q3
│
└─ Module: "Storage & Databases"
├─ Main competence: "Data Management"
└─ ...
