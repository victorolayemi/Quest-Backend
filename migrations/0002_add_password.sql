-- Migration to add password column to User table
ALTER TABLE "User" ADD COLUMN "password" TEXT;
