document.getElementById("taskForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const titleField = document.getElementById("taskTitle");
  const enteredTitles = parseTaskTitleLines(titleField.value);
  const title = editingId
    ? normalizeSingleLineText(titleField.value)
    : enteredTitles[0] || "";

  if (!title) {
    document.getElementById("taskTitle").focus();
    return;
  }

  const data = {
    title,
    templateId: document.getElementById("taskTemplate").value || null,
    emailSubject:
      document.getElementById("taskEmailSubject").value.trim() || null,
    sender: document.getElementById("taskSender").value.trim() || null,
    description:
      document.getElementById("taskDescription").value.trim() || null,
    project:
      normalizeSingleLineText(document.getElementById("taskProject").value) ||
      null,
    imageDataUrl: taskDraftImageDataUrl || "",
    imageName: taskDraftImageName || "",
    category: document.getElementById("taskCategory").value,
    priority: normalizePriority(document.getElementById("taskPriority").value),
    status: normalizeStatus(document.getElementById("taskStatus").value),
    progressPercent: editingId
      ? normalizeTaskProgressPercent(getTaskById(editingId)?.progressPercent)
      : 0,
    receivedAt: document.getElementById("taskReceivedAt").value || null,
    startedAt: document.getElementById("taskStartedAt").value || null,
    completedAt: document.getElementById("taskCompletedAt").value || null,
    dueDate: document.getElementById("taskDueDate").value || null,
    notes: document.getElementById("taskNotes").value.trim() || null,
  };

  if (data.status === "Completed") {
    data.progressPercent = 100;
  }

  if (editingId) {
    const idx = tasks.findIndex((t) => t.id === editingId);
    if (idx !== -1) {
      const previousTask = tasks[idx];
      const nextSubtasks =
        previousTask.templateId !== data.templateId
          ? buildTaskSubtasks(data.templateId)
          : previousTask.subtasks || [];
      items = items.map((item) =>
        item.taskId === editingId
          ? { ...item, taskTitleSnapshot: data.title }
          : item,
      );
      Object.assign(tasks[idx], data, {
        subtasks: nextSubtasks,
      });
      applyTaskStatusChange(tasks[idx], data.status, {
        previousStatus: data.status,
      });
    }
  } else {
    const newTasks = enteredTitles.map((taskTitle) => {
      const newTask = {
        id: genId(),
        createdAt: today(),
        isFavorite: false,
        startedAt: data.startedAt || null,
        completedAt: data.completedAt || null,
        subtasks: buildTaskSubtasks(data.templateId),
        ...data,
        title: taskTitle,
      };
      applyTaskStatusChange(newTask, data.status, {
        previousStatus: data.status,
      });
      return newTask;
    });
    tasks = [...newTasks, ...tasks];
    selectedTaskId = newTasks[0]?.id || selectedTaskId;
  }

  saveTasks();
  saveItems();
  renderTasks();
  closeModal();
});

document.getElementById("taskForm").addEventListener("change", () => {
  syncTaskLifecycleDraftDates();
  syncTaskModalFieldAccents();
});

document
  .getElementById("taskImageInput")
  .addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      taskDraftImageDataUrl = await buildItemImageData(file);
      taskDraftImageName = file.name;
      updateTaskImagePreview();
    } catch (error) {
      alert(error?.message || "Unable to process the selected image.");
      clearTaskDraftImage();
    }
  });

document.getElementById("clearTaskImageBtn").addEventListener("click", () => {
  clearTaskDraftImage();
});
