(function () {
  "use strict";

  const statusList = [
    "Not Started",
    "Planned",
    "In Progress",
    "Waiting",
    "Blocked",
    "On Hold",
    "Under Review",
    "Testing",
    "Deployed",
    "Completed",
    "Cancelled",
    "Failed",
    "Reopened",
    "Deprecated",
    "Archived",
    "Deferred",
    "Scheduled",
  ];

  const priorityList = [
    "Low",
    "Medium",
    "High",
    "Critical",
    "Urgent",
    "Emergency",
  ];

  const departmentList = [
    "IT",
    "HR",
    "Finance",
    "Operations",
    "Marketing",
    "Sales",
    "Procurement",
    "Support",
    "Management",
    "Legal",
    "Engineering",
    "QA",
    "Security",
  ];

  const categoryList = [
    "Bug Fix",
    "Feature",
    "Improvement",
    "Research",
    "Maintenance",
    "Documentation",
    "Meeting",
    "Incident",
    "Automation",
    "Analysis",
    "Optimization",
    "Refactoring",
    "Deployment",
    "Support Task",
  ];

  const riskList = ["None", "Low", "Medium", "High", "Severe", "Critical Risk"];
  const progressList = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
  const yesNoList = ["Yes", "No"];
  const reviewStatusList = [
    "Not Reviewed",
    "In Review",
    "Approved",
    "Rejected",
    "Needs Changes",
  ];
  const taskTypeList = [
    "Task",
    "Epic",
    "Story",
    "Subtask",
    "Spike",
    "Incident",
  ];
  const environmentList = [
    "Development",
    "Test",
    "Staging",
    "Production",
    "Sandbox",
  ];
  const regionList = [
    "North America",
    "Europe",
    "Middle East",
    "Asia Pacific",
    "Remote",
  ];
  const effortSizeList = ["XS", "S", "M", "L", "XL"];

  const LIST_TABLE_DEFINITIONS = [
    {
      tableName: "tblStatusCodes",
      header: "Status",
      values: statusList,
      definedName: "StatusOptions",
    },
    {
      tableName: "tblPriorityLevels",
      header: "Priority",
      values: priorityList,
      definedName: "PriorityOptions",
    },
    {
      tableName: "tblDepartments",
      header: "Department",
      values: departmentList,
      definedName: "DepartmentOptions",
    },
    {
      tableName: "tblCategories",
      header: "Category",
      values: categoryList,
      definedName: "CategoryOptions",
    },
    {
      tableName: "tblRiskLevels",
      header: "Risk Level",
      values: riskList,
      definedName: "RiskOptions",
    },
    {
      tableName: "tblProgressSteps",
      header: "Progress %",
      values: progressList,
      definedName: "ProgressOptions",
    },
    {
      tableName: "tblYesNoList",
      header: "YesNo",
      values: yesNoList,
      definedName: "YesNoOptions",
    },
    {
      tableName: "tblReviewStatus",
      header: "Review Status",
      values: reviewStatusList,
      definedName: "ReviewStatusOptions",
    },
    {
      tableName: "tblTaskTypes",
      header: "Task Type",
      values: taskTypeList,
      definedName: "TaskTypeOptions",
    },
    {
      tableName: "tblEnvironments",
      header: "Environment",
      values: environmentList,
      definedName: "EnvironmentOptions",
    },
    {
      tableName: "tblRegions",
      header: "Region",
      values: regionList,
      definedName: "RegionOptions",
    },
    {
      tableName: "tblEffortSizes",
      header: "Effort",
      values: effortSizeList,
      definedName: "EffortOptions",
    },
  ];

  window.ExcelListsGeneratorConfig = Object.freeze({
    statusList,
    priorityList,
    departmentList,
    categoryList,
    riskList,
    progressList,
    yesNoList,
    reviewStatusList,
    taskTypeList,
    environmentList,
    regionList,
    effortSizeList,
    LIST_TABLE_DEFINITIONS,
  });
})();
