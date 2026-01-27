-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "isFallAdmission" BOOLEAN NOT NULL,
    "major" TEXT NOT NULL,
    "doubleMajors" TEXT[],
    "minors" TEXT[],
    "advancedMajor" BOOLEAN NOT NULL DEFAULT false,
    "individuallyDesignedMajor" BOOLEAN NOT NULL DEFAULT false,
    "enrollments" JSONB NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "major" TEXT NOT NULL,
    "doubleMajors" TEXT[],
    "minors" TEXT[],
    "advancedMajor" BOOLEAN NOT NULL,
    "individuallyDesignedMajor" BOOLEAN NOT NULL,
    "courses" JSONB NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "credit" INTEGER NOT NULL,
    "au" INTEGER NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralEdRequirement" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,

    CONSTRAINT "GeneralEdRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MajorRequirement" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,

    CONSTRAINT "MajorRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_studentId_key" ON "Profile"("studentId");

-- CreateIndex
CREATE INDEX "CourseOffering_code_idx" ON "CourseOffering"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_code_title_category_tags_credit_au_key" ON "CourseOffering"("code", "title", "category", "tags", "credit", "au");

-- CreateIndex
CREATE INDEX "GeneralEdRequirement_year_type_idx" ON "GeneralEdRequirement"("year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralEdRequirement_year_type_key" ON "GeneralEdRequirement"("year", "type");

-- CreateIndex
CREATE INDEX "MajorRequirement_year_department_type_idx" ON "MajorRequirement"("year", "department", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MajorRequirement_year_department_type_key" ON "MajorRequirement"("year", "department", "type");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
