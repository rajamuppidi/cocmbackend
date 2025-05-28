-- MySQL dump 10.13  Distrib 8.0.33, for macos13 (x86_64)
--
-- Host: localhost    Database: caseload_tracker
-- ------------------------------------------------------
-- Server version	8.0.33

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assessments`
--

DROP TABLE IF EXISTS `assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `type` enum('PHQ-9','GAD-7') NOT NULL,
  `score` int NOT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `answers_json` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `idx_assessments_patient_date_type` (`patient_id`,`date`,`type`),
  CONSTRAINT `assessments_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=185 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessments`
--

LOCK TABLES `assessments` WRITE;
/*!40000 ALTER TABLE `assessments` DISABLE KEYS */;
INSERT INTO `assessments` VALUES (177,41,'PHQ-9',19,'2025-04-26','2025-04-28 02:04:26','[3,3,3,3,2,2,2,1,0]'),(178,41,'GAD-7',16,'2025-04-26','2025-04-28 02:04:26','[2,2,0,3,3,3,3]'),(179,43,'PHQ-9',13,'2025-05-01','2025-05-02 20:56:59','[0,1,0,3,3,1,0,3,2]'),(180,43,'GAD-7',3,'2025-05-01','2025-05-02 20:56:59','[0,0,0,1,1,1,0]'),(181,42,'PHQ-9',5,'2025-05-26','2025-05-28 01:36:16','[0,0,0,0,0,0,1,2,2]'),(182,42,'GAD-7',15,'2025-05-26','2025-05-28 01:36:16','[3,3,0,0,3,3,3]'),(183,42,'PHQ-9',7,'2025-05-26','2025-05-28 01:37:40','[0,0,0,2,0,0,0,3,2]'),(184,42,'GAD-7',4,'2025-05-26','2025-05-28 01:37:40','[0,0,2,0,0,0,2]');
/*!40000 ALTER TABLE `assessments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `care_manager_notes`
--

DROP TABLE IF EXISTS `care_manager_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `care_manager_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `user_id` int NOT NULL,
  `note_date` date NOT NULL,
  `content` text NOT NULL,
  `referral_needed` tinyint(1) DEFAULT '0',
  `psych_referral_note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `care_manager_notes_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `care_manager_notes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `care_manager_notes`
--

LOCK TABLES `care_manager_notes` WRITE;
/*!40000 ALTER TABLE `care_manager_notes` DISABLE KEYS */;
/*!40000 ALTER TABLE `care_manager_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `caseload_statistics`
--

DROP TABLE IF EXISTS `caseload_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `caseload_statistics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinic_id` int DEFAULT NULL,
  `active_patients` int DEFAULT NULL,
  `inactive_patients` int DEFAULT NULL,
  `new_patients` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `caseload_statistics_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `caseload_statistics`
--

LOCK TABLES `caseload_statistics` WRITE;
/*!40000 ALTER TABLE `caseload_statistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `caseload_statistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clinics`
--

DROP TABLE IF EXISTS `clinics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clinics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `organization_id` int DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `organization_id` (`organization_id`),
  CONSTRAINT `clinics_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clinics`
--

LOCK TABLES `clinics` WRITE;
/*!40000 ALTER TABLE `clinics` DISABLE KEYS */;
INSERT INTO `clinics` VALUES (7,'Marquette General Health ',NULL,'Marquette','5553224555','info@mgh.com');
/*!40000 ALTER TABLE `clinics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_attempts`
--

DROP TABLE IF EXISTS `contact_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contact_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `attempt_date` date NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `contact_attempts_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_attempts`
--

LOCK TABLES `contact_attempts` WRITE;
/*!40000 ALTER TABLE `contact_attempts` DISABLE KEYS */;
INSERT INTO `contact_attempts` VALUES (15,41,'2025-04-27','Hello This is a test note');
/*!40000 ALTER TABLE `contact_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `contact_date` date NOT NULL,
  `contact_type` enum('Care Manager Consultation','Psychiatric Consultation','Initial Assessment','Follow-up Assessment') NOT NULL,
  `assessment_type` enum('PHQ-9','GAD-7') NOT NULL,
  `duration_minutes` int DEFAULT NULL,
  `flag_psychiatric_consult` tinyint(1) DEFAULT '0',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `interaction_mode` enum('in_clinic','by_phone','by_video','in_group') NOT NULL,
  `discuss_with_consultant` tinyint(1) DEFAULT '0',
  `psychiatric_consultant_id` int DEFAULT NULL,
  `consultant_notes` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_contacts_patient_date` (`patient_id`,`contact_date`),
  KEY `fk_psych_consultant` (`psychiatric_consultant_id`),
  CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `contacts_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_psych_consultant` FOREIGN KEY (`psychiatric_consultant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contacts`
--

LOCK TABLES `contacts` WRITE;
/*!40000 ALTER TABLE `contacts` DISABLE KEYS */;
INSERT INTO `contacts` VALUES (86,41,'2025-04-26','Initial Assessment','PHQ-9',10,0,'',9,'in_clinic',0,NULL,NULL),(87,43,'2025-05-01','Initial Assessment','PHQ-9',50,1,'See this patient carefully',9,'in_clinic',1,8,NULL),(88,42,'2025-05-26','Initial Assessment','PHQ-9',10,0,'',9,'in_clinic',0,NULL,NULL),(89,42,'2025-05-26','Follow-up Assessment','PHQ-9',40,0,NULL,9,'by_phone',0,NULL,NULL);
/*!40000 ALTER TABLE `contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deactivations`
--

DROP TABLE IF EXISTS `deactivations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deactivations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `deactivation_date` date NOT NULL,
  `reason` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `deactivations_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deactivations`
--

LOCK TABLES `deactivations` WRITE;
/*!40000 ALTER TABLE `deactivations` DISABLE KEYS */;
/*!40000 ALTER TABLE `deactivations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `minute_tracking`
--

DROP TABLE IF EXISTS `minute_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `minute_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `total_minutes` int DEFAULT NULL,
  `tracking_date` date NOT NULL,
  `contact_attempt_id` int DEFAULT NULL,
  `psych_consult_id` int DEFAULT NULL,
  `activity_type` varchar(50) DEFAULT 'Patient Contact',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `contact_attempt_id` (`contact_attempt_id`),
  KEY `fk_psych_consult` (`psych_consult_id`),
  CONSTRAINT `fk_psych_consult` FOREIGN KEY (`psych_consult_id`) REFERENCES `psych_consultations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `minute_tracking_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `minute_tracking_ibfk_2` FOREIGN KEY (`contact_attempt_id`) REFERENCES `contact_attempts` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `minute_tracking`
--

LOCK TABLES `minute_tracking` WRITE;
/*!40000 ALTER TABLE `minute_tracking` DISABLE KEYS */;
INSERT INTO `minute_tracking` VALUES (1,5,4,'2024-09-30',NULL,NULL,'Patient Contact'),(2,5,50,'2024-09-30',NULL,NULL,'Patient Contact'),(3,5,50,'2024-09-30',NULL,NULL,'Patient Contact'),(4,5,6,'2024-10-01',NULL,NULL,'Patient Contact'),(5,9,3,'2024-10-01',NULL,NULL,'Patient Contact'),(6,9,20,'2024-10-02',NULL,NULL,'Patient Contact'),(7,8,15,'2024-10-23',NULL,NULL,'Patient Contact'),(8,8,26,'2024-10-23',NULL,NULL,'Patient Contact'),(9,8,26,'2024-10-23',NULL,NULL,'Patient Contact'),(10,8,5,'2024-10-23',NULL,NULL,'Patient Contact'),(11,8,6,'2024-10-23',NULL,NULL,'Patient Contact'),(12,8,19,'2024-10-23',NULL,NULL,'Patient Contact'),(13,8,50,'2024-10-23',NULL,NULL,'Patient Contact'),(14,8,30,'2024-10-30',NULL,NULL,'Patient Contact'),(15,8,30,'2024-10-30',NULL,NULL,'Patient Contact'),(16,8,17,'2024-11-08',NULL,NULL,'Patient Contact'),(17,8,59,'2024-11-08',NULL,NULL,'Patient Contact'),(18,8,10,'2024-11-08',NULL,NULL,'Patient Contact'),(19,8,10,'2024-11-08',NULL,NULL,'Patient Contact'),(20,9,20,'2024-11-08',NULL,NULL,'Patient Contact'),(21,9,5,'2024-11-11',NULL,NULL,'Patient Contact'),(22,9,6,'2024-11-20',NULL,NULL,'Patient Contact'),(23,9,3,'2024-11-18',NULL,NULL,'Patient Contact'),(24,9,50,'2024-11-14',NULL,NULL,'Patient Contact'),(25,9,5,'2024-12-01',NULL,NULL,'Patient Contact'),(26,9,10,'2024-12-04',NULL,NULL,'Patient Contact'),(27,9,15,'2024-12-05',NULL,NULL,'Patient Contact'),(28,9,15,'2024-11-10',NULL,NULL,'Patient Contact'),(29,9,15,'2024-12-02',NULL,NULL,'Patient Contact'),(30,9,5,'2024-12-10',NULL,NULL,'Patient Contact'),(31,9,30,'2025-02-07',NULL,NULL,'Patient Contact'),(32,9,50,'2025-02-07',NULL,NULL,'Patient Contact'),(33,9,20,'2025-02-08',NULL,NULL,'Patient Contact'),(35,9,20,'2025-02-06',NULL,NULL,'Patient Contact'),(36,9,22,'2025-02-09',NULL,NULL,'Patient Contact'),(37,9,60,'2025-02-09',NULL,NULL,'Patient Contact'),(38,9,25,'2025-02-12',NULL,NULL,'Patient Contact'),(39,9,45,'2025-02-12',NULL,NULL,'Patient Contact'),(40,9,15,'2025-02-11',NULL,NULL,'Patient Contact'),(41,9,9,'2025-02-11',NULL,NULL,'Patient Contact'),(42,9,50,'2025-02-26',NULL,NULL,'Patient Contact'),(43,9,15,'2025-02-27',NULL,NULL,'Patient Contact'),(44,9,20,'2025-02-27',NULL,NULL,'Patient Contact'),(45,9,20,'2025-02-27',NULL,NULL,'Patient Contact'),(46,9,50,'2025-02-27',NULL,NULL,'Patient Contact'),(47,9,20,'2025-02-27',NULL,NULL,'Patient Contact'),(48,9,10,'2025-02-28',NULL,NULL,'Patient Contact'),(49,9,17,'2025-03-04',NULL,NULL,'Patient Contact'),(50,9,7,'2025-03-04',NULL,NULL,'Patient Contact'),(51,9,7,'2025-03-04',NULL,NULL,'Patient Contact'),(52,9,10,'2025-03-04',NULL,NULL,'Patient Contact'),(53,9,20,'2025-03-13',NULL,NULL,'Patient Contact'),(54,9,10,'2025-03-17',NULL,NULL,'Patient Contact'),(55,9,30,'2025-03-17',NULL,NULL,'Patient Contact'),(56,9,10,'2025-03-18',NULL,NULL,'Patient Contact'),(57,9,17,'2025-03-17',NULL,NULL,'Patient Contact'),(58,9,5,'2025-03-17',NULL,NULL,'Patient Contact'),(59,9,20,'2025-02-24',NULL,NULL,'Patient Contact'),(60,9,3,'2025-03-12',NULL,NULL,'Patient Contact'),(61,9,11,'2025-03-17',NULL,NULL,'Patient Contact'),(62,9,11,'2025-03-17',NULL,NULL,'Patient Contact'),(63,9,15,'2025-03-18',NULL,NULL,'Patient Contact'),(64,9,9,'2025-03-18',NULL,NULL,'Patient Contact'),(65,9,6,'2025-03-12',NULL,NULL,'Patient Contact'),(66,9,14,'2025-03-18',NULL,NULL,'Patient Contact'),(67,9,8,'2025-03-22',NULL,NULL,'Patient Contact'),(68,9,50,'2025-03-26',NULL,NULL,'Patient Contact'),(69,9,6,'2025-03-27',NULL,NULL,'Patient Contact'),(70,9,60,'2025-03-28',NULL,NULL,'Patient Contact'),(71,9,10,'2025-03-28',NULL,NULL,'Patient Contact'),(72,9,20,'2025-04-02',NULL,NULL,'Patient Contact'),(73,9,50,'2025-04-01',NULL,NULL,'Patient Contact'),(74,9,50,'2025-04-02',NULL,NULL,'Patient Contact'),(75,9,30,'2025-04-02',NULL,NULL,'Patient Contact'),(77,9,10,'2025-04-01',NULL,NULL,'Patient Contact'),(78,9,5,'2025-04-01',NULL,NULL,'Patient Contact'),(79,9,28,'2025-04-01',NULL,NULL,'Patient Contact'),(80,9,13,'2025-03-30',NULL,NULL,'Patient Contact'),(81,9,32,'2025-04-01',NULL,NULL,'Patient Contact'),(82,9,21,'2025-04-01',NULL,NULL,'Patient Contact'),(85,9,5,'2025-04-01',NULL,NULL,'Patient Contact'),(86,9,16,'2025-04-01',NULL,NULL,'Patient Contact'),(87,9,1,'2025-04-01',NULL,NULL,'Patient Contact'),(88,9,3,'2025-04-01',NULL,NULL,'Patient Contact'),(90,9,30,'2025-04-07',NULL,NULL,'Patient Contact'),(92,9,15,'2025-04-07',NULL,NULL,'Patient Contact'),(93,9,50,'2025-04-07',NULL,NULL,'Patient Contact'),(94,9,120,'2025-04-07',NULL,NULL,'Patient Contact'),(97,9,30,'2025-04-27',NULL,NULL,'Patient Contact'),(98,9,30,'2025-04-27',NULL,NULL,'Patient Contact'),(99,9,30,'2025-04-27',NULL,NULL,'Patient Contact'),(100,9,30,'2025-04-27',NULL,NULL,'Patient Contact'),(101,9,30,'2025-04-27',NULL,NULL,'Patient Contact'),(102,9,10,'2025-04-26',NULL,NULL,'Patient Contact'),(103,9,7,'2025-04-27',15,NULL,'Patient Contact'),(104,9,60,'2025-05-01',NULL,NULL,'Patient Contact'),(105,9,50,'2025-05-01',NULL,NULL,'Patient Contact'),(106,9,20,'2025-05-18',NULL,NULL,'Safety Plan'),(107,9,10,'2025-05-27',NULL,NULL,'Patient Contact'),(108,9,10,'2025-05-26',NULL,NULL,'Patient Contact'),(109,9,10,'2025-05-28',NULL,NULL,'Safety Plan'),(110,9,40,'2025-05-26',NULL,NULL,'Patient Contact'),(111,9,100,'2025-05-28',NULL,NULL,'Safety Plan');
/*!40000 ALTER TABLE `minute_tracking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organizations`
--

DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizations`
--

LOCK TABLES `organizations` WRITE;
/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_consultants`
--

DROP TABLE IF EXISTS `patient_consultants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_consultants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `consultant_id` int NOT NULL,
  `referral_date` date NOT NULL,
  `referral_reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_patient_consultant` (`patient_id`,`consultant_id`),
  KEY `consultant_id` (`consultant_id`),
  CONSTRAINT `patient_consultants_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `patient_consultants_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_consultants`
--

LOCK TABLES `patient_consultants` WRITE;
/*!40000 ALTER TABLE `patient_consultants` DISABLE KEYS */;
/*!40000 ALTER TABLE `patient_consultants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_flags`
--

DROP TABLE IF EXISTS `patient_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_flags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `flag` enum('Psychiatric Consult','Pediatric Patient','Safety Plan') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `patient_flags_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_flags`
--

LOCK TABLES `patient_flags` WRITE;
/*!40000 ALTER TABLE `patient_flags` DISABLE KEYS */;
INSERT INTO `patient_flags` VALUES (58,41,'Pediatric Patient'),(60,43,'Psychiatric Consult');
/*!40000 ALTER TABLE `patient_flags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_intake`
--

DROP TABLE IF EXISTS `patient_intake`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_intake` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `created_by` int NOT NULL,
  `contact_date` date NOT NULL,
  `symptoms_json` json NOT NULL,
  `columbia_suicide_severity` varchar(255) DEFAULT NULL,
  `anxiety_panic_attacks` text,
  `past_mental_health_json` json NOT NULL,
  `psychiatric_hospitalizations` text,
  `substance_use_json` json NOT NULL,
  `medical_history_json` json NOT NULL,
  `other_medical_history` text,
  `family_mental_health_json` json NOT NULL,
  `social_situation_json` json NOT NULL,
  `current_medications` text,
  `past_medications` text,
  `narrative` text,
  `minutes` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id_idx` (`patient_id`),
  KEY `created_by_idx` (`created_by`),
  CONSTRAINT `fk_patient_intake_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_patient_intake_patient_id` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_intake`
--

LOCK TABLES `patient_intake` WRITE;
/*!40000 ALTER TABLE `patient_intake` DISABLE KEYS */;
INSERT INTO `patient_intake` VALUES (21,41,9,'2025-04-27','{\"paranoia\": false, \"flashbacks\": false, \"nightmares\": false, \"changeInSleep\": false, \"depressedMood\": false, \"fearfulOnEdge\": false, \"muscleTension\": false, \"talkingTooFast\": false, \"historyOfTrauma\": false, \"constantWorrying\": false, \"feelingGuiltyBad\": false, \"suicidalThoughts\": false, \"difficultyTrusting\": false, \"severeIrritability\": true, \"compulsiveBehaviors\": false, \"fatigueFromWorrying\": false, \"hearingSeeingThings\": false, \"lowEnergyMotivation\": true, \"elevatedEuphoricMood\": true, \"troubleConcentrating\": false, \"worryingAboutJudgment\": false, \"avoidingTraumaTriggers\": false, \"littlePleasureInterest\": false, \"lowOrIncreasedAppetite\": false, \"unableToControlWorrying\": false, \"avoidingSocialSituations\": false, \"impulsivityOutOfCharacter\": false, \"recurrentUnwantedThoughts\": false, \"troubleSleepingDueToWorry\": false, \"avoidingPanicAttackTriggers\": false}',NULL,NULL,'{\"suicideAttempt\": false, \"therapyCounselingPast\": false, \"therapyCounselingCurrent\": false, \"substanceUseTreatmentOutpatient\": false, \"substanceUseTreatmentResidential\": false}',NULL,'{\"alcohol\": {\"past\": true, \"current\": false}, \"cocaine\": {\"past\": true, \"current\": false}, \"cannabis\": {\"past\": true, \"current\": false}, \"painPills\": {\"past\": true, \"current\": false}, \"heroinFentanyl\": {\"past\": true, \"current\": false}, \"methamphetamine\": {\"past\": true, \"current\": false}, \"prescriptionMisuse\": {\"past\": true, \"current\": false}}','{\"htn\": false, \"thyroid\": true, \"diabetes\": true, \"copdAsthma\": true, \"dyslipemia\": true, \"drugAllergies\": true}',NULL,'{\"anxiety\": true, \"depression\": true, \"substanceUse\": true, \"schizophrenia\": true, \"bipolarDisorder\": true}','{\"children\": \"0\", \"employment\": \"No\", \"maritalStatus\": \"Single\", \"livingSituation\": \"Home\"}',NULL,NULL,NULL,30,'2025-04-28 00:58:50'),(22,43,9,'2025-05-01','{\"paranoia\": false, \"flashbacks\": false, \"nightmares\": false, \"changeInSleep\": true, \"depressedMood\": false, \"fearfulOnEdge\": false, \"muscleTension\": false, \"talkingTooFast\": false, \"historyOfTrauma\": false, \"constantWorrying\": false, \"feelingGuiltyBad\": false, \"suicidalThoughts\": false, \"difficultyTrusting\": false, \"severeIrritability\": false, \"compulsiveBehaviors\": true, \"fatigueFromWorrying\": false, \"hearingSeeingThings\": false, \"lowEnergyMotivation\": true, \"elevatedEuphoricMood\": false, \"troubleConcentrating\": false, \"worryingAboutJudgment\": false, \"avoidingTraumaTriggers\": false, \"littlePleasureInterest\": false, \"lowOrIncreasedAppetite\": false, \"unableToControlWorrying\": false, \"avoidingSocialSituations\": true, \"impulsivityOutOfCharacter\": true, \"recurrentUnwantedThoughts\": false, \"troubleSleepingDueToWorry\": false, \"avoidingPanicAttackTriggers\": false}',NULL,NULL,'{\"suicideAttempt\": true, \"therapyCounselingPast\": true, \"therapyCounselingCurrent\": true, \"substanceUseTreatmentOutpatient\": false, \"substanceUseTreatmentResidential\": false}',NULL,'{\"alcohol\": {\"past\": false, \"current\": true}, \"cocaine\": {\"past\": false, \"current\": true}, \"cannabis\": {\"past\": false, \"current\": true}, \"painPills\": {\"past\": false, \"current\": true}, \"heroinFentanyl\": {\"past\": false, \"current\": true}, \"methamphetamine\": {\"past\": false, \"current\": true}, \"prescriptionMisuse\": {\"past\": false, \"current\": true}}','{\"htn\": true, \"thyroid\": true, \"diabetes\": true, \"copdAsthma\": false, \"dyslipemia\": true, \"drugAllergies\": false}',NULL,'{\"anxiety\": true, \"depression\": true, \"substanceUse\": true, \"schizophrenia\": false, \"bipolarDisorder\": false}','{\"children\": \"5\", \"employment\": \"Walmart\", \"maritalStatus\": \"Single\", \"livingSituation\": \"Well\"}','Prozac','Retinol','This patient is too much dangerous ',60,'2025-05-02 20:56:02'),(23,42,9,'2025-05-27','{\"paranoia\": true, \"flashbacks\": false, \"nightmares\": false, \"changeInSleep\": false, \"depressedMood\": false, \"fearfulOnEdge\": false, \"muscleTension\": false, \"talkingTooFast\": false, \"historyOfTrauma\": false, \"constantWorrying\": false, \"feelingGuiltyBad\": false, \"suicidalThoughts\": false, \"difficultyTrusting\": true, \"severeIrritability\": true, \"compulsiveBehaviors\": false, \"fatigueFromWorrying\": false, \"hearingSeeingThings\": false, \"lowEnergyMotivation\": false, \"elevatedEuphoricMood\": true, \"troubleConcentrating\": false, \"worryingAboutJudgment\": false, \"avoidingTraumaTriggers\": false, \"littlePleasureInterest\": false, \"lowOrIncreasedAppetite\": false, \"unableToControlWorrying\": false, \"avoidingSocialSituations\": false, \"impulsivityOutOfCharacter\": true, \"recurrentUnwantedThoughts\": false, \"troubleSleepingDueToWorry\": false, \"avoidingPanicAttackTriggers\": false}',NULL,NULL,'{\"suicideAttempt\": false, \"therapyCounselingPast\": false, \"therapyCounselingCurrent\": false, \"substanceUseTreatmentOutpatient\": false, \"substanceUseTreatmentResidential\": false}',NULL,'{\"alcohol\": {\"past\": false, \"current\": false}, \"cocaine\": {\"past\": false, \"current\": false}, \"cannabis\": {\"past\": false, \"current\": false}, \"painPills\": {\"past\": false, \"current\": false}, \"heroinFentanyl\": {\"past\": false, \"current\": false}, \"methamphetamine\": {\"past\": false, \"current\": false}, \"prescriptionMisuse\": {\"past\": false, \"current\": false}}','{\"htn\": false, \"thyroid\": false, \"diabetes\": false, \"copdAsthma\": false, \"dyslipemia\": false, \"drugAllergies\": false}',NULL,'{\"anxiety\": false, \"depression\": false, \"substanceUse\": false, \"schizophrenia\": true, \"bipolarDisorder\": false}','{\"children\": \"\", \"employment\": \"\", \"maritalStatus\": \"\", \"livingSituation\": \"\"}',NULL,NULL,NULL,10,'2025-05-28 01:35:50');
/*!40000 ALTER TABLE `patient_intake` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patients`
--

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `dob` date NOT NULL,
  `mrn` varchar(255) NOT NULL,
  `clinic_id` int DEFAULT NULL,
  `status` enum('E','A','R','D','T') NOT NULL,
  `enrollment_date` date NOT NULL,
  `phq9_first` int DEFAULT NULL,
  `phq9_last` int DEFAULT NULL,
  `gad7_first` int DEFAULT NULL,
  `gad7_last` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mrn` (`mrn`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patients`
--

LOCK TABLES `patients` WRITE;
/*!40000 ALTER TABLE `patients` DISABLE KEYS */;
INSERT INTO `patients` VALUES (41,'Versatile','Vans','2011-04-13','M224442',7,'A','2025-04-27',19,19,16,16),(42,'James','Cameron','1989-04-04','M93421',7,'A','2025-04-27',5,7,15,4),(43,'Steve','Smith','1993-05-04','M844232',7,'A','2025-05-02',13,13,3,3);
/*!40000 ALTER TABLE `patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `psych_consultations`
--

DROP TABLE IF EXISTS `psych_consultations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `psych_consultations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `consultant_id` int NOT NULL,
  `consult_date` date NOT NULL,
  `minutes` int NOT NULL,
  `recommendations` text NOT NULL,
  `treatment_plan` text,
  `medications` text,
  `follow_up_needed` tinyint(1) DEFAULT '0',
  `next_follow_up_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `consultant_id` (`consultant_id`),
  CONSTRAINT `psych_consultations_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `psych_consultations_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `psych_consultations`
--

LOCK TABLES `psych_consultations` WRITE;
/*!40000 ALTER TABLE `psych_consultations` DISABLE KEYS */;
/*!40000 ALTER TABLE `psych_consultations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quality_metrics`
--

DROP TABLE IF EXISTS `quality_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quality_metrics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clinic_id` int DEFAULT NULL,
  `metric_name` varchar(255) NOT NULL,
  `metric_value` varchar(255) NOT NULL,
  `metric_date` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `quality_metrics_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quality_metrics`
--

LOCK TABLES `quality_metrics` WRITE;
/*!40000 ALTER TABLE `quality_metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `quality_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `relapse_prevention_plans`
--

DROP TABLE IF EXISTS `relapse_prevention_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `relapse_prevention_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `plan_date` date NOT NULL,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `relapse_prevention_plans_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `relapse_prevention_plans`
--

LOCK TABLES `relapse_prevention_plans` WRITE;
/*!40000 ALTER TABLE `relapse_prevention_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `relapse_prevention_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminders`
--

DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int DEFAULT NULL,
  `care_manager_id` int NOT NULL,
  `reminder_date` date NOT NULL,
  `description` text,
  `reminder_type` enum('Initial Assessment','Follow-up Assessment','Other') NOT NULL,
  `status` enum('pending','completed','dismissed') NOT NULL DEFAULT 'pending',
  `completed_by` int DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `completed_by` (`completed_by`),
  KEY `idx_reminders_care_manager` (`care_manager_id`,`status`,`reminder_date`),
  CONSTRAINT `reminders_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `reminders_ibfk_2` FOREIGN KEY (`care_manager_id`) REFERENCES `users` (`id`),
  CONSTRAINT `reminders_ibfk_3` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminders`
--

LOCK TABLES `reminders` WRITE;
/*!40000 ALTER TABLE `reminders` DISABLE KEYS */;
INSERT INTO `reminders` VALUES (49,41,9,'2025-05-03','Follow-up Assessment due for patient','Follow-up Assessment','pending',NULL,NULL,'2025-04-28 02:04:26'),(50,43,9,'2025-05-08','Follow-up Assessment due for patient','Follow-up Assessment','pending',NULL,NULL,'2025-05-02 20:56:59'),(51,42,9,'2025-06-02','Follow-up Assessment due for patient','Follow-up Assessment','pending',NULL,NULL,'2025-05-28 01:36:16'),(52,42,9,'2025-06-02','Follow-up Assessment due for patient','Follow-up Assessment','pending',NULL,NULL,'2025-05-28 01:37:40');
/*!40000 ALTER TABLE `reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reminders_backup`
--

DROP TABLE IF EXISTS `reminders_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reminders_backup` (
  `id` int NOT NULL DEFAULT '0',
  `patient_id` int DEFAULT NULL,
  `reminder_date` date NOT NULL,
  `description` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reminders_backup`
--

LOCK TABLES `reminders_backup` WRITE;
/*!40000 ALTER TABLE `reminders_backup` DISABLE KEYS */;
/*!40000 ALTER TABLE `reminders_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `safety_plan_history`
--

DROP TABLE IF EXISTS `safety_plan_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `safety_plan_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `action` enum('created','resolved') NOT NULL,
  `action_date` datetime NOT NULL,
  `resolved_by` int DEFAULT NULL,
  `minutes_spent` int DEFAULT '0',
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `resolved_by` (`resolved_by`),
  CONSTRAINT `safety_plan_history_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `safety_plan_history_ibfk_2` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `safety_plan_history`
--

LOCK TABLES `safety_plan_history` WRITE;
/*!40000 ALTER TABLE `safety_plan_history` DISABLE KEYS */;
INSERT INTO `safety_plan_history` VALUES (1,43,'resolved','2025-05-18 14:11:36',9,20,'Yes i discussed '),(2,42,'resolved','2025-05-27 18:36:57',9,10,'Safety plan completed by me.'),(3,42,'resolved','2025-05-27 18:37:59',9,100,'Done Done');
/*!40000 ALTER TABLE `safety_plan_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_clinics`
--

DROP TABLE IF EXISTS `user_clinics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_clinics` (
  `user_id` int NOT NULL,
  `clinic_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`clinic_id`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `user_clinics_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_clinics_ibfk_2` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_clinics`
--

LOCK TABLES `user_clinics` WRITE;
/*!40000 ALTER TABLE `user_clinics` DISABLE KEYS */;
INSERT INTO `user_clinics` VALUES (6,7),(7,7),(8,7),(9,7);
/*!40000 ALTER TABLE `user_clinics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_patients`
--

DROP TABLE IF EXISTS `user_patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_patients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `provider_type` enum('BHCM','Psychiatric Consultant','Primary Care Physician') DEFAULT NULL,
  `service_begin_date` date DEFAULT NULL,
  `service_end_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_provider_per_patient` (`patient_id`,`provider_type`,`service_begin_date`),
  KEY `user_id` (`user_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `user_patients_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_patients_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_patients`
--

LOCK TABLES `user_patients` WRITE;
/*!40000 ALTER TABLE `user_patients` DISABLE KEYS */;
INSERT INTO `user_patients` VALUES (112,9,41,'BHCM','2025-04-27',NULL),(113,9,42,'BHCM','2025-04-27',NULL),(114,9,43,'BHCM','2025-05-02',NULL),(115,8,43,'Psychiatric Consultant','2025-05-01',NULL);
/*!40000 ALTER TABLE `user_patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('BHCM','Psychiatric Consultant','Primary Care Provider','Admin','Primary Care Physician') NOT NULL,
  `clinic_id` int DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `employee_id` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `clinic_id` (`clinic_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`clinic_id`) REFERENCES `clinics` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Raja Muppidi','rmuppidi@mtu.edu','$2a$10$NiN5wLI1GjuGFta4M.zzCuz00JxwVbuvgZqQwuNEYr7zTOfgmYZoC','Admin',NULL,NULL,NULL),(5,'demo','demo@demo.com','$2b$10$rTByQVcCI3t/TMOfUz38t.9TmO8sfHbDlZJBknCRlu8EMWd1lcdCq','BHCM',NULL,'1234123123',NULL),(6,'demo1','demo1@demo.com','$2b$10$m4K51AVjHEu4UtCqivj7peWJ6/lDqiwMpjTOi5GH1iEDY/DViYm9m','Psychiatric Consultant',NULL,'1212121112',NULL),(7,'Pcp','primary@demo.com','$2b$10$rjj11kFfMX89d/KSOnbZJOnL3zlV0mwGbcxutScRYHux38gY1oh4O','Primary Care Physician',NULL,'1231231233',NULL),(8,'Kelley Mahar','maharpsych@gmail.com','$2b$10$G0VoyetT8CjFcgYL5dOeQ.aqE/JM44hWzJkF0FUfHN5CUJzEpuYD6','Psychiatric Consultant',NULL,'9063602636',NULL),(9,'Kristie Hechtman','khechtman@uphcs.org','$2b$10$5KO/NkCiJ7nlW0VJozEzrOoWW/qT9drPpEYw/EWCmL7MQxWxvZvTe','BHCM',NULL,'9062321601',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-27 19:49:38
