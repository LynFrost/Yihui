function closeHistoryTextPopover() {
  document.querySelectorAll("[data-history-popover]").forEach((popover) => popover.remove());
}

function hasPinnedHistoryTextPopover() {
  return Boolean(document.querySelector("[data-history-popover].is-pinned"));
}

function positionHistoryTextPopover(popover, source) {
  const rect = source.getBoundingClientRect();
  const margin = 12;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
  const width = Math.min(Math.max(rect.width, 420), viewportWidth - margin * 2);
  popover.style.width = `${Math.max(260, width)}px`;
  const measuredHeight = Math.min(popover.offsetHeight || 260, viewportHeight - margin * 2);
  const belowTop = rect.bottom + 6;
  const aboveTop = rect.top - measuredHeight - 6;
  const top = belowTop + measuredHeight <= viewportHeight - margin
    ? belowTop
    : Math.max(margin, aboveTop);
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, viewportWidth - width - margin),
  );
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function toggleHistoryTextPopover(source, pinned = false) {
  if (!source) {
    closeHistoryTextPopover();
    return;
  }
  const text = source.dataset.historyPopoverText || source.textContent || "";
  if (!String(text).trim()) {
    closeHistoryTextPopover();
    return;
  }
  closeHistoryTextPopover();
  const popover = document.createElement("div");
  popover.className = pinned ? "history-popover is-pinned" : "history-popover";
  popover.dataset.historyPopover = "true";
  popover.dataset.historyPopoverKind = source.dataset.historyPopoverKind || "";
  const content = document.createElement("div");
  content.className = "history-popover-content";
  content.textContent = text;
  popover.append(content);
  document.body.append(popover);
  positionHistoryTextPopover(popover, source);
}

function showHistoryTextPopover(source) {
  if (document.querySelector("[data-history-popover].is-pinned")) {
    return;
  }
  toggleHistoryTextPopover(source, false);
}

function isRunningInstance(instance) {
  return Boolean(instance?.pending || instance?.generation_status === "running");
}

function formatSource(source) {
  return sourceLabel(source);
}

function renderSelectedOption(value, label, selectedValue) {
  const selected = value === selectedValue ? "selected" : "";
  return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
}

function sourceLabel(source) {
  if (source === "generated") {
    return "生成";
  }
  if (source === "prepared") {
    return "准备";
  }
  if (source === "failed") {
    return "失败";
  }
  return source || "未知";
}

function instanceHasOutput(item) {
  return Boolean(
    String(item?.output_image_path || "").trim()
      || instanceOutputImagePaths(item).length
  );
}

function instanceStatusLabel(item) {
  if (item?.generation_status === "failed") {
    return "失败";
  }
  if (instanceHasOutput(item) && item?.generation_status !== "running") {
    return "生成";
  }
  return "准备";
}

function instanceStatusClass(item) {
  if (item?.generation_status === "failed") {
    return "is-failed";
  }
  if (instanceHasOutput(item) && item?.generation_status !== "running") {
    return "is-generated";
  }
  return "is-prepared";
}

function canEditInstanceProvider(item) {
  return !instanceHasOutput(item) || item?.generation_status === "failed";
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  return String(value).replace("T", " ").slice(0, 19);
}

function formatDateParts(value) {
  const formatted = formatDate(value);
  if (!formatted) {
    return { date: "", time: "" };
  }
  const [date, time = ""] = formatted.split(" ");
  return { date, time };
}

function editingDraft(instance) {
  return state.editing.get(instance.id) || null;
}

function cloneInstanceForEdit(instance) {
  return {
    id: instance.id,
    prompt: instance.prompt || "",
    mode: instance.mode || "unspecified",
    source: instance.source || "manual",
    provider: instance.provider || null,
    generation_path: instance.generation_path || "",
    generation_size: instance.generation_size || "",
    generation_status: instance.generation_status || "ready",
    generation_params: instance.generation_params && typeof instance.generation_params === "object"
      ? { ...instance.generation_params }
      : {},
    output_image_path: instance.output_image_path || "",
    input_image_paths: Array.isArray(instance.input_image_paths) ? [...instance.input_image_paths] : [],
    tags: Array.isArray(instance.tags) ? [...instance.tags] : [],
    tag_draft: "",
    tag_selector_open: false,
  };
}

function instanceOutputImagePaths(item) {
  const paths = Array.isArray(item?.output_image_paths) ? item.output_image_paths : [];
  const cleaned = paths
    .map((path) => String(path || "").trim())
    .filter(Boolean);
  const primary = String(item?.output_image_path || "").trim();
  if (primary && !cleaned.includes(primary)) {
    cleaned.unshift(primary);
  }
  return cleaned;
}

function isPreparedInstance(item) {
  return Boolean(
    item
      && !item.pending
      && item.generation_status !== "running"
      && item.generation_status !== "failed"
      && !String(item.output_image_path || "").trim()
  );
}

function renderImageFieldHeader(label, options = {}) {
  const {
    editable = false,
    action = "",
    instanceId = "",
    buttonLabel = "清理",
  } = options;
  const idAttr = instanceId === "" ? "" : ` data-id="${escapeHtml(instanceId)}"`;
  const button = editable && action
    ? `<button type="button" class="image-field-clear" data-action="${escapeHtml(action)}"${idAttr}>${escapeHtml(buttonLabel)}</button>`
    : "";

  return `
    <div class="image-field-header">
      <span>${escapeHtml(label)}</span>
      ${button}
    </div>
  `;
}

function renderProviderSourceRow(item, editable) {
  const running = isRunningInstance(item);
  const sourceBadge = running
    ? ""
    : `<span class="source-badge ${escapeHtml(instanceStatusClass(item))}">${escapeHtml(instanceStatusLabel(item))}</span>`;
  const providerEditable = Boolean(editable && !running && canEditInstanceProvider(item));
  if (!providerEditable) {
    return `
      <div class="provider-source-row instance-provider-note">
        <span>Provider：${escapeHtml(instanceProviderText(item.provider))}</span>
        ${sourceBadge}
      </div>
    `;
  }

  return `
    <div class="provider-source-row instance-provider-note is-editable">
      <label class="manual-provider-input">
        <span>Provider：</span>
        <select name="instance_provider" title="Provider">
          ${providerOptionsSelect(item.provider || "")}
        </select>
      </label>
      ${sourceBadge}
    </div>
  `;
}


function renderInstanceModelSelector(item, pending = false) {
  const providerKey = String(item?.provider || item?.generation_params?.provider_key || "").trim();
  const provider = state.settings?.providers?.[providerKey] || null;
  const currentModel = String(provider?.model || "").trim();
  const rawCandidates = Array.isArray(provider?.model_candidates) ? provider.model_candidates : [];
  const candidates = rawCandidates
    .map((candidate) => {
      if (typeof candidate === "string") {
        return { id: candidate.trim(), verified: false };
      }
      return {
        id: String(candidate?.id || candidate?.model || "").trim(),
        verified: Boolean(candidate?.verified),
      };
    })
    .filter((candidate) => candidate.id);
  if (currentModel && !candidates.some((candidate) => candidate.id === currentModel)) {
    candidates.unshift({ id: currentModel, verified: false });
  }
  const instanceId = String(item?.id || "");
  const dropdownKey = `${instanceId}:${providerKey}`;
  const open = Boolean(providerKey && provider && !pending && state.instanceModelDropdownOpenKey === dropdownKey);
  const options = candidates.map((candidate) => {
    const selected = candidate.id === currentModel;
    const statusClass = candidate.verified ? "is-verified" : "is-pending";
    const statusText = candidate.verified ? "已验证" : "待验证";
    const deleteAttrs = selected ? 'disabled title="当前模型不能删除，请先切换模型"' : "";
    return `
      <div class="instance-model-option ${selected ? "is-selected" : ""}">
        <button type="button" class="instance-model-option-main"
          data-action="select-provider-model-candidate"
          data-id="${escapeHtml(instanceId)}"
          data-provider-key="${escapeHtml(providerKey)}"
          data-model-id="${escapeHtml(candidate.id)}"
          ${selected ? 'aria-current="true"' : ""}>
          <span class="instance-model-option-name" title="${escapeHtml(candidate.id)}">${escapeHtml(candidate.id)}</span>
          <span class="instance-model-option-status ${statusClass}">${statusText}</span>
        </button>
        <button type="button" class="instance-model-option-delete"
          data-action="delete-provider-model-candidate"
          data-id="${escapeHtml(instanceId)}"
          data-provider-key="${escapeHtml(providerKey)}"
          data-model-id="${escapeHtml(candidate.id)}"
          ${deleteAttrs}
          aria-label="删除模型 ${escapeHtml(candidate.id)}">×</button>
      </div>
    `;
  }).join("");
  const disabled = !providerKey || !provider || pending ? "disabled" : "";
  return `
    <div class="instance-model-selector ${open ? "is-open" : ""}">
      <span class="instance-model-label">model</span>
      <div class="instance-model-combobox">
        <button type="button" class="instance-model-trigger"
          data-action="toggle-instance-model-dropdown"
          data-id="${escapeHtml(instanceId)}"
          data-provider-key="${escapeHtml(providerKey)}"
          ${disabled}
          aria-expanded="${open ? "true" : "false"}"
          title="${escapeHtml(currentModel || "未设置模型")}">
          <span class="instance-model-current">${escapeHtml(currentModel || "未设置")}</span>
          <span class="instance-model-arrow" aria-hidden="true">▾</span>
        </button>
        ${open ? `
          <div class="instance-model-dropdown" data-skip-batch-save="true">
            ${options || '<div class="instance-model-empty">暂无模型，请添加</div>'}
            <button type="button" class="instance-model-add"
              data-action="add-provider-model-candidate"
              data-id="${escapeHtml(instanceId)}"
              data-provider-key="${escapeHtml(providerKey)}">＋ 添加模型</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function instanceNumberLabel(instance) {
  const serverLabel = String(instance?.instance_number_label || "").trim();
  if (serverLabel) {
    return serverLabel;
  }
  const number = Number.parseInt(instance?.instance_number, 10);
  if (Number.isFinite(number) && number > 0) {
    return `#${String(number).padStart(4, "0")}`;
  }
  return `#${String(instance?.id || 0).padStart(4, "0")}`;
}

function instanceGenerationCount(item) {
  const generation_params = item?.generation_params || {};
  const raw = generation_params.n ?? generation_params.count ?? 1;
  return normalizeGenerationCount(raw);
}

function canEditInstanceCount(item) {
  return !isRunningInstance(item) && (!instanceHasOutput(item) || item?.generation_status === "failed");
}

function renderInstanceCountControl(item) {
  const current = instanceGenerationCount(item);
  const readonlyAttr = canEditInstanceCount(item) ? "" : "readonly aria-readonly=\"true\"";
  return `
    <input name="instance_generation_count" class="instance-count-input" value="${escapeHtml(current)}" title="数量 n" inputmode="numeric" autocomplete="off" ${readonlyAttr}>
  `;
}

const renderInstanceCountSelect = renderInstanceCountControl;

function formatPendingElapsed(startedAtMs) {
  const started = Number(startedAtMs) || performance.now();
  const elapsedSeconds = Math.max(0, (performance.now() - started) / 1000);
  return `${elapsedSeconds.toFixed(1)} s`;
}

function pendingStatusText(item, startedAtMs) {
  return formatPendingElapsed(startedAtMs || item?.started_at_ms);
}

function pendingRetryLabel(item) {
  const error = String(item?.generation_error || "").trim();
  const match = error.match(/第\s*(\d+)\s*次(?:生成)?失败/);
  return match ? `第${match[1]}次重试` : "";
}

function renderInstanceSelection(instance, pending) {
  if (pending) {
    return "";
  }
  const id = String(instance.id);
  const checked = state.selectedInstanceIds?.has(id) ? "checked" : "";
  return `
    <label class="instance-select" data-skip-batch-save="true" title="选择实例">
      <input type="checkbox" data-action="toggle-select-instance" data-id="${escapeHtml(id)}" ${checked} aria-label="选择实例">
    </label>
  `;
}

function renderInstanceTagPopover(item, editable) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const instanceId = escapeHtml(item.id);
  const chips = tags.map((tag, index) => `
    <span class="tag-chip instance-tag-popover-chip">
      <span class="instance-tag-popover-label">${escapeHtml(tag)}</span>
      ${editable
        ? `<button type="button" data-action="remove-instance-tag" data-id="${instanceId}" data-index="${index}" aria-label="移除标签 ${escapeHtml(tag)}">×</button>`
        : ""}
    </span>
  `).join("");

  return `
    <div class="instance-tag-popover" data-instance-tag-popover="true" role="group" aria-label="完整标签">
      ${chips || `<span class="instance-tag-popover-empty">暂无标签</span>`}
    </div>
  `;
}

function renderInstanceCard(instance) {
  const pending = isRunningInstance(instance);
  const draft = pending ? null : editingDraft(instance);
  const item = draft || instance;
  const editable = Boolean(draft);
  const tagEditable = !pending;
  const instanceId = item.id;
  const pendingKey = pending ? runningInstanceKey(item) : "";
  const pendingStartMs = pending
    ? (item.started_at_ms || state.pendingStartedAtByKey.get(pendingKey) || performance.now())
    : "";
  const inputSlots = (item.input_image_paths || [])
    .map((path, index) =>
      renderSavedImageSlot(path, {
        addAction: "choose-instance-input-images",
        removeAction: "remove-instance-input-image",
        instanceId,
        index,
        editable,
      }),
    )
    .join("");
  const inputAddSlot = renderSavedImageSlot("", {
    addAction: "choose-instance-input-images",
    removeAction: "remove-instance-input-image",
    instanceId,
    editable,
    reserveOnly: !editable,
  });
  const pendingText = pending ? pendingStatusText(item, pendingStartMs) : "";
  const pendingCancelling = Boolean(item?.cancelling);
  const outputPaths = instanceOutputImagePaths(item);
  const outputSlots = outputPaths.length
    ? outputPaths.map((path, index) => renderSavedImageSlot(path, {
      addAction: "choose-instance-output-image",
      removeAction: index === 0 ? "remove-instance-output-image" : "",
      instanceId,
      editable: editable && index === 0,
      emptyText: pending ? pendingText : "无输出图",
      replaceWhenFilled: index === 0,
      pendingKey,
      pendingStartMs,
    })).join("")
    : renderSavedImageSlot("", {
      addAction: "choose-instance-output-image",
      removeAction: "remove-instance-output-image",
      instanceId,
      editable,
      emptyText: pending ? pendingText : "无输出图",
      replaceWhenFilled: true,
      pendingKey,
      pendingStartMs,
    });
  const dateParts = formatDateParts(instance.created_at);
  const sizeText = instance.generation_size
    ? `<span class="instance-size">${escapeHtml(instance.generation_size)}</span>`
    : "";
  const headerLabel = pending
    ? pendingText
    : instanceNumberLabel(instance);
  const failed = item.generation_status === "failed";
  const prepared = isPreparedInstance(item);
  const copyAction = `<button type="button" data-action="copy-submit-instance" data-id="${escapeHtml(instanceId)}">复制</button>`;
  const submitAction = prepared
    ? `<button type="button" class="submit-instance-button" data-action="submit-manual-instance" data-id="${escapeHtml(instanceId)}">提交</button>`
    : `<button type="button" class="submit-instance-button" disabled title="已有输出图">提交</button>`;
  const clearTagsAction = Array.isArray(item.tags) && item.tags.length
    ? `<button type="button" class="instance-clear-tags-chip" data-action="clear-instance-tags" data-id="${escapeHtml(instanceId)}" title="清除标签">X</button>`
    : "";
  const tagSelector = renderTagSelector({
    scope: "instance",
    tags: item.tags,
    draft: item.tag_draft,
    editable: tagEditable,
    instanceId,
    open: Boolean(item.tag_selector_open),
    popoverHtml: renderInstanceTagPopover(item, tagEditable),
    popoverPinned: Boolean(
      state.instanceTagPopover?.pinned
      && String(state.instanceTagPopover.instanceId) === String(instanceId)
    ),
  });
  const inlineActions = pending
    ? `
      <div class="instance-inline-actions is-pending">
        ${tagSelector}
      </div>
    `
    : failed
      ? `
        <div class="instance-inline-actions">
          ${tagSelector}
          ${clearTagsAction}
          <button type="button" data-action="bring-instance-to-operation" data-id="${escapeHtml(instanceId)}">带入</button>
          ${copyAction}
          <button type="button" class="submit-instance-button" data-action="retry-failed-instance" data-id="${escapeHtml(instanceId)}">重提</button>
        </div>
      `
      : `
        <div class="instance-inline-actions">
          ${tagSelector}
          ${clearTagsAction}
          <button type="button" data-action="bring-instance-to-operation" data-id="${escapeHtml(instanceId)}">带入</button>
          ${copyAction}
          ${submitAction}
        </div>
      `;


  return `
    <article ${
      pending
        ? `class="image-record record-row instance-card is-pending"`
        : `class="image-record record-row instance-card"`
    } data-instance-card data-id="${escapeHtml(instanceId)}">
      <div class="record-meta instance-card-header ${pending ? "" : "instance-select-zone"}" ${pending ? "" : `data-action="toggle-select-zone" data-id="${escapeHtml(instanceId)}" data-skip-batch-save="true"`} title="${pending ? "" : "点击选中实例"}">
        ${renderInstanceSelection(instance, pending)}
        <strong ${pending ? `data-pending-elapsed-key="${escapeHtml(pendingKey)}" data-pending-start-ms="${escapeHtml(pendingStartMs)}"` : ""}>${escapeHtml(headerLabel)}</strong>
        <time class="instance-date">${escapeHtml(dateParts.date)}</time>
        <time class="instance-time">${escapeHtml(dateParts.time)}</time>
        ${sizeText}
      </div>
      ${renderPromptField({
        name: "instance_prompt",
        value: item.prompt,
        readonly: !editable,
        className: "record-prompt instance-prompt",
        clearAction: editable ? "clear-instance-prompt" : "",
        copyAction: "copy-instance-prompt",
        countAction: renderInstanceCountControl(item),
        instanceId,
        retryLabel: pending ? pendingRetryLabel(item) : "",
      })}
      <div class="field record-input-images">
        ${renderImageFieldHeader("输入图", {
          editable,
          action: "clear-instance-input-images",
          instanceId,
          buttonLabel: "清除",
        })}
        <div class="image-grid instance-image-grid">
          ${inputSlots}
          ${inputAddSlot}
        </div>
      </div>
      <div class="field record-output-image">
        <span>输出图</span>
        <div class="image-grid image-grid-single ${outputPaths.length > 1 ? "image-grid-multiple-output" : ""}">
          ${outputSlots}
        </div>
      </div>
      <div class="field record-detail">
        <div class="detail-stack">
          ${renderProviderSourceRow(item, editable)}
          ${renderInstanceModelSelector(item, pending)}
          ${inlineActions}
        </div>
      </div>
      <div class="record-actions instance-actions">
        ${
          pending
            ? `
              <div class="instance-action-slot">
                <button type="button" class="danger" data-action="cancel-generation-task" data-task-id="${escapeHtml(item.generation_task_id || item.task_id || "")}" ${pendingCancelling ? "disabled" : ""}>${pendingCancelling ? "取消中" : "取消"}</button>
              </div>
            `
            : 
          editable
            ? `
              <div class="instance-action-slot">
                <button type="button" class="primary" data-action="save-instance" data-id="${escapeHtml(instanceId)}">保存</button>
              </div>
              <div class="instance-action-slot">
                <button type="button" data-action="cancel-edit-instance" data-id="${escapeHtml(instanceId)}" data-skip-batch-save="true">取消</button>
              </div>
              <div class="instance-action-slot">
                <button type="button" class="danger" data-action="delete-instance" data-id="${escapeHtml(instanceId)}">删除</button>
              </div>
            `
            : `
              <div class="instance-action-slot">
                <button type="button" data-action="edit-instance" data-id="${escapeHtml(instanceId)}">编辑</button>
              </div>
              <div class="instance-action-slot instance-action-slot-spacer" aria-hidden="true"></div>
              <div class="instance-action-slot">
                <button type="button" class="danger" data-action="delete-instance" data-id="${escapeHtml(instanceId)}">删除</button>
              </div>
            `
        }
      </div>
    </article>
  `;
}

function renderInstanceTagEditor(item, editable) {
  const reservedClass = editable ? "" : " tag-editor-reserved";
  const inputAttrs = editable ? "" : "readonly tabindex=\"-1\"";
  const buttonAttrs = editable ? "" : "disabled aria-hidden=\"true\" tabindex=\"-1\"";

  return `
    <div class="tag-editor${reservedClass}">
      <input name="instance_tag_draft" value="${escapeHtml(item.tag_draft || "")}" placeholder="添加标签" ${inputAttrs}>
      <button type="button" data-action="add-instance-tag" data-id="${escapeHtml(item.id)}" ${buttonAttrs}>添加</button>
    </div>
  `;
}

function renderInstanceTags(item, editable) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (!tags.length) {
    return "";
  }

  return tags
    .map(
      (tag, index) => `
        <span class="tag-chip">
          ${escapeHtml(tag)}
          ${
            editable
              ? `<button type="button" data-action="remove-instance-tag" data-id="${escapeHtml(item.id)}" data-index="${index}" aria-label="移除标签">×</button>`
              : ""
          }
        </span>
      `,
    )
    .join("");
}

function renderLightbox() {
  if (!state.lightbox.path) {
    return "";
  }

  const zoomPercent = Math.round(state.lightbox.zoom * 100);
  const canSwitch = (state.lightbox.gallery || []).length > 1;
  const imageContent = state.lightbox.error
    ? `<div class="lightbox-error">${escapeHtml(state.lightbox.error)}</div>`
    : `
      <img
        class="lightbox-image"
        src="${escapeHtml(imageUrl(state.lightbox.path))}"
        alt="原图"
        draggable="false"
        style="--lightbox-zoom: ${escapeHtml(state.lightbox.zoom)}; --lightbox-pan-x: ${escapeHtml(state.lightbox.panX || 0)}px; --lightbox-pan-y: ${escapeHtml(state.lightbox.panY || 0)}px"
      >
    `;

  return `
    <div class="lightbox-backdrop" data-lightbox-backdrop="true" data-skip-batch-save="true" role="dialog" aria-modal="true" aria-label="图片查看">
      <div class="lightbox-toolbar">
        <button type="button" data-action="lightbox-zoom-out" aria-label="缩小">-</button>
        <span>${escapeHtml(zoomPercent)}%</span>
        <button type="button" data-action="lightbox-zoom-in" aria-label="放大">+</button>
        <button type="button" data-action="lightbox-fit">适应窗口</button>
        <button type="button" data-action="close-lightbox">关闭</button>
      </div>
      <div class="lightbox-stage" data-lightbox-close-area="true">
        <button type="button" class="lightbox-nav lightbox-prev" data-action="lightbox-prev" ${canSwitch ? "" : "disabled"} aria-label="上一张">‹</button>
        ${imageContent}
        <button type="button" class="lightbox-nav lightbox-next" data-action="lightbox-next" ${canSwitch ? "" : "disabled"} aria-label="下一张">›</button>
      </div>
    </div>
  `;
}

function bindSaveAreaEvents() {
  const toolbar = document.querySelector("[data-save-toolbar]");
  if (!toolbar) {
    return;
  }

  for (const name of ["mode_filter", "provider", "size", "call_method", "model", "sort", "per_page"]) {
    toolbar.elements[name]?.addEventListener("change", () => applySaveFilters(toolbar));
  }
  toolbar.elements.save_layout?.addEventListener("change", (event) => {
    setSaveLayout(event.target.value);
  });
  toolbar.elements.tag_filter_search?.addEventListener("input", (event) => {
    state.filters.tag_search = event.target.value || "";
    renderManager();
    document.querySelector('[name="tag_filter_search"]')?.focus();
  });
}


Object.assign(globalThis, {
  closeHistoryTextPopover,
  hasPinnedHistoryTextPopover,
  positionHistoryTextPopover,
  toggleHistoryTextPopover,
  showHistoryTextPopover,
  formatSource,
  renderSelectedOption,
  sourceLabel,
  instanceHasOutput,
  instanceStatusLabel,
  instanceStatusClass,
  canEditInstanceProvider,
  formatDate,
  formatDateParts,
  editingDraft,
  cloneInstanceForEdit,
  instanceOutputImagePaths,
  isPreparedInstance,
  renderImageFieldHeader,
  renderProviderSourceRow,
  instanceNumberLabel,
  instanceGenerationCount,
  canEditInstanceCount,
  renderInstanceCountControl,
  renderInstanceCountSelect,
  formatPendingElapsed,
  pendingStatusText,
  pendingRetryLabel,
  renderInstanceSelection,
  renderInstanceCard,
  renderInstanceTagEditor,
  renderInstanceTags,
  isRunningInstance,
  renderLightbox,
  bindSaveAreaEvents,
});
