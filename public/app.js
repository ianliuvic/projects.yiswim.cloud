// ====================== 全局配置（由 EJS 模板注入） ======================
const PROJECT_ID = window.__CONFIG__.projectId;
const USER_ROLE = window.__CONFIG__.userRole;

// ====================== 常量 ======================
const STATUS_MAP = { '需求': 0, '准备': 1, '生产': 2, '质检': 3, '运输': 4, '完成': 5 };
const STEPS_NAME = ['需求', '准备', '生产', '质检', '运输', '完成'];
const STEPS_ID = ['requirement', 'preparation', 'production', 'qa', 'transport', 'done'];
const STORAGE_KEY = `tracker_token_${PROJECT_ID}`;
const LANG_STORAGE_KEY = 'lang';

// ====================== 全局状态 ======================
let BACKEND_DATA = {};
let state = {};
let quill = null;

// ====================== 工具函数 ======================
function formatDateStr(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatNowTime() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (UTC+8)`;
}

// ====================== i18next 初始化 ======================
function initI18next() {
  const savedLang = localStorage.getItem(LANG_STORAGE_KEY) || 'zh';
  const resources = window.I18N_RESOURCES;

  // 供应商角色动态修改品牌文字
  if (USER_ROLE === 'supplier') {
    resources.zh.translation["title"] = "项目跟踪 - 伊之安科技";
    resources.zh.translation["footer.company"] = "伊之安科技 (Yisian Technology)";
    resources.en.translation["title"] = "Project Tracker - Yisian Technology";
    resources.en.translation["footer.company"] = "Yisian Technology";
  }

  i18next.init({
    lng: savedLang,
    resources: resources,
    fallbackLng: 'zh',
    debug: false
  }).then(function () {
    updateAllContent();
    highlightActiveLangButton();
  });
}

function updateAllContent() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = i18next.t(el.getAttribute('data-i18n'));
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    el.placeholder = i18next.t(el.getAttribute('data-i18n-placeholder'));
  });

  document.title = i18next.t('title');

  if (quill) {
    quill.root.setAttribute('data-placeholder', i18next.t('editor.placeholder'));
  }

  updateDynamicContent();
}

function highlightActiveLangButton() {
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.lang === i18next.language);
  });
}

function updateDynamicContent() {
  if (!BACKEND_DATA || !BACKEND_DATA.project_data) return;

  var projectData = BACKEND_DATA.project_data;

  var typeKey = 'val.' + projectData.type;
  document.getElementById('displayType').innerText = i18next.exists(typeKey)
    ? i18next.t(typeKey)
    : (projectData.type || i18next.t('default.type'));

  var statusKey = 'val.' + projectData.status;
  document.getElementById('displayStatus').innerText = i18next.exists(statusKey)
    ? i18next.t(statusKey)
    : (projectData.status || i18next.t('default.unknown'));

  var roleKey = 'val.' + BACKEND_DATA.role;
  document.getElementById('displayRole').innerText = i18next.exists(roleKey)
    ? i18next.t(roleKey)
    : i18next.t('role.visitor');
}

// ====================== 日期渲染 ======================
function renderProjectDates() {
  var orderDateContainer = document.getElementById('orderDateContainer');
  var deliveryDateContainer = document.getElementById('deliveryDateContainer');
  var projectData = BACKEND_DATA.project_data || {};

  if (projectData.orders && projectData.orders.length > 0) {
    var earliestOrderDate = null;
    var latestDeliveryDate = null;

    projectData.orders.forEach(function (order) {
      if (order.order_date) {
        var oDate = new Date(order.order_date);
        if (!isNaN(oDate.getTime())) {
          if (!earliestOrderDate || oDate < earliestOrderDate) earliestOrderDate = oDate;
        }
      }
      if (order.delivery_date) {
        var dDate = new Date(order.delivery_date);
        if (!isNaN(dDate.getTime())) {
          if (!latestDeliveryDate || dDate > latestDeliveryDate) latestDeliveryDate = dDate;
        }
      }
    });

    if (earliestOrderDate && orderDateContainer) {
      var oDateStr = formatDateStr(earliestOrderDate);
      if (oDateStr) {
        document.getElementById('displayOrderDate').innerText = oDateStr;
        orderDateContainer.style.display = 'flex';
      }
    }

    if (deliveryDateContainer) {
      if (latestDeliveryDate && (BACKEND_DATA.role === 'write' || BACKEND_DATA.role === 'admin')) {
        var dDateStr = formatDateStr(latestDeliveryDate);
        if (dDateStr) {
          var target = new Date(latestDeliveryDate);
          target.setHours(0, 0, 0, 0);
          var now = new Date();
          now.setHours(0, 0, 0, 0);
          var diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

          var badgeClass = '';
          var badgeText = '';

          if (diffDays > 3) {
            badgeClass = 'badge-safe';
            badgeText = i18next.t('days.remaining').replace('{{count}}', diffDays);
          } else if (diffDays > 0) {
            badgeClass = 'badge-warning';
            badgeText = i18next.t('days.remaining').replace('{{count}}', diffDays);
          } else if (diffDays === 0) {
            badgeClass = 'badge-warning';
            badgeText = i18next.t('days.today');
          } else {
            badgeClass = 'badge-danger';
            badgeText = i18next.t('days.overdue').replace('{{count}}', Math.abs(diffDays));
          }

          document.getElementById('displayDeliveryDate').innerHTML =
            dDateStr + ' <span class="badge ' + badgeClass + '">' + badgeText + '</span>';
          deliveryDateContainer.style.display = 'flex';
        }
      } else {
        deliveryDateContainer.innerHTML = '';
        deliveryDateContainer.style.display = 'none';
      }
    }
  } else {
    if (orderDateContainer) orderDateContainer.style.display = 'none';
    if (deliveryDateContainer) deliveryDateContainer.style.display = 'none';
  }
}

// ====================== Token 验证 ======================
async function verifyToken(token, isAutoLogin) {
  var btn = document.getElementById('verifyBtn');
  var errorMsg = document.getElementById('authError');
  var modal = document.getElementById('authModal');
  var appContainer = document.getElementById('appContainer');

  if (!isAutoLogin) {
    btn.innerText = i18next.t('modal.verifying');
    btn.disabled = true;
    errorMsg.style.display = 'none';
  }

  try {
    var response = await fetch('/api/get-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: PROJECT_ID, token: token })
    });
    var result = await response.json();

    if (result.success) {
      localStorage.setItem(STORAGE_KEY, token);
      modal.style.display = 'none';
      appContainer.style.display = 'block';

      BACKEND_DATA = result.data;
      var projectData = BACKEND_DATA.project_data || {};

      document.getElementById('displayUuid').innerText = projectData.uuid || PROJECT_ID;
      updateDynamicContent();
      renderProjectDates();

      var rawNodes = projectData.nodesData || BACKEND_DATA.nodesData || {};
      var normalizedNodes = {};

      Object.keys(rawNodes).forEach(function (key) {
        var val = rawNodes[key];
        if (Array.isArray(val)) {
          normalizedNodes[key] = val.map(function (item) {
            return { time: item.time || i18next.t('timeline.early'), html: item.html || '' };
          });
        } else if (typeof val === 'object' && val !== null) {
          var arr = [];
          if (val.text) arr.push({ time: '订单详情', html: val.text });
          if (val.logs && Array.isArray(val.logs)) {
            val.logs.forEach(function (log) { arr.push({ time: '系统日志', html: log }); });
          }
          normalizedNodes[key] = arr;
        } else {
          normalizedNodes[key] = [];
        }
      });

      STEPS_ID.forEach(function (step) {
        if (!normalizedNodes[step]) normalizedNodes[step] = [];
      });

      var realStatusIndex = projectData.status ? (STATUS_MAP[projectData.status] || 0) : 0;

      state = {
        maxStepIndex: realStatusIndex,
        activeStepIndex: realStatusIndex,
        nodesData: normalizedNodes
      };

      initApp();
    } else {
      localStorage.removeItem(STORAGE_KEY);
      if (!isAutoLogin) {
        errorMsg.innerText = result.message || i18next.t('modal.error');
        errorMsg.style.display = 'block';
      }
      btn.innerText = i18next.t('modal.button');
      btn.disabled = false;
      if (isAutoLogin) modal.style.display = 'flex';
    }
  } catch (error) {
    console.error(error);
    if (!isAutoLogin) {
      errorMsg.innerText = '网络错误，请稍后再试';
      errorMsg.style.display = 'block';
    }
    btn.innerText = i18next.t('modal.button');
    btn.disabled = false;
    if (isAutoLogin) modal.style.display = 'flex';
  }
}

// ====================== 应用初始化 ======================
function initApp() {
  var editorContainer = document.querySelector('.editor-container');
  var editorFooter = document.querySelector('.editor-footer');

  // 仅管理员可见邮件通知按钮
  var emailBtn = document.getElementById('emailNotifyBtn');
  if (emailBtn) {
    emailBtn.style.display = (BACKEND_DATA.role === 'admin') ? 'inline-block' : 'none';
  }

  if (BACKEND_DATA.role === 'read') {
    if (editorContainer) editorContainer.style.display = 'none';
    if (editorFooter) editorFooter.style.display = 'none';
  } else {
    if (editorContainer) editorContainer.style.display = 'block';
    if (editorFooter) editorFooter.style.display = 'flex';

    if (!quill) {
      var icons = Quill.import('ui/icons');
      icons['attachment'] = '<svg viewbox="0 0 24 24"><path d="M16.5,6v11.5c0,2.21-1.79,4-4,4s-4-1.79-4-4V5c0-1.38,1.12-2.5,2.5-2.5s2.5,1.12,2.5,2.5v10.5c0,0.55-0.45,1-1,1s-1-0.45-1-1V6H10v9.5c0,1.38,1.12,2.5,2.5,2.5s2.5-1.12,2.5-2.5V5c0-2.21-1.79-4-4-4S7,2.79,7,5v12.5c0,3.31,2.69,6,6,6s6-2.69,6-6V6H16.5z"/></svg>';

      quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: i18next.t('editor.placeholder'),
        modules: {
          toolbar: {
            container: [
              [{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered' }, { 'list': 'bullet' }],
              ['blockquote', 'code-block'], ['image', 'attachment', 'link', 'video'],
              ['clean']
            ],
            handlers: {
              'image': imageHandler,
              'attachment': fileHandler
            }
          },
          imageResize: {
            displaySize: true,
            modules: ['Resize', 'DisplaySize', 'Toolbar']
          }
        }
      });

      var Delta = Quill.import('delta');

      // 拦截粘贴图片
      quill.root.addEventListener('paste', function (e) {
        if (e.clipboardData && e.clipboardData.items) {
          var hasImage = false;
          Array.from(e.clipboardData.items).forEach(function (item) {
            if (item.type.indexOf('image/') === 0) {
              hasImage = true;
              var file = item.getAsFile();
              if (file) uploadAndInsertImage(file);
            }
          });
          if (hasImage) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);

      // 拦截拖拽图片
      quill.root.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) {
          var hasImage = false;
          Array.from(e.dataTransfer.files).forEach(function (file) {
            if (file.type.indexOf('image/') === 0) {
              hasImage = true;
              uploadAndInsertImage(file);
            }
          });
          if (hasImage) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);

      // 拦截 Base64 图片粘贴
      quill.clipboard.addMatcher('IMG', function (node, delta) {
        var src = node.getAttribute('src');
        if (src && src.startsWith('data:image/')) {
          fetch(src)
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
              var ext = 'png';
              var match = src.match(/^data:image\/(\w+);base64,/);
              if (match) ext = match[1];
              var file = new File([blob], 'pasted-image.' + ext, { type: blob.type });
              uploadAndInsertImage(file);
            });
          return new Delta();
        }
        return delta;
      });
    }
  }

  renderStepper();
  renderTimeline();
  updateAllContent();
}

// ====================== 图片预览 ======================
var currentImageList = [];
var currentIndex = 0;

function openImagePreview() {
  updateModalImage();
  document.getElementById('imagePreviewModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function updateModalImage() {
  var fullImg = document.getElementById('previewImage');
  var counter = document.getElementById('modalCounter');
  var prevBtn = document.getElementById('modalPrev');
  var nextBtn = document.getElementById('modalNext');

  fullImg.src = currentImageList[currentIndex];
  counter.innerText = (currentIndex + 1) + ' / ' + currentImageList.length;

  if (currentImageList.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
  }
}

function changeImage(n) {
  currentIndex += n;
  if (currentIndex >= currentImageList.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = currentImageList.length - 1;
  updateModalImage();
}

function closeImagePreview() {
  document.getElementById('imagePreviewModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ====================== 图片上传 ======================
async function uploadAndInsertImage(file, index) {
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB');
    return;
  }

  var formData = new FormData();
  formData.append('image', file);

  var insertIndex = (index !== undefined && index !== null) ? index : null;
  if (insertIndex === null) {
    var range = quill.getSelection(true);
    insertIndex = range ? range.index : quill.getLength();
  }

  quill.insertText(insertIndex, '[图片上传中...]', { color: '#999' });

  try {
    var response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    var data = await response.json();

    quill.deleteText(insertIndex, '[图片上传中...]'.length);

    if (data.success && data.url) {
      quill.insertEmbed(insertIndex, 'image', data.url);
      quill.setSelection(insertIndex + 1);
    } else {
      alert('图片上传失败：' + (data.message || '未知错误'));
    }
  } catch (error) {
    console.error('图片上传出错', error);
    quill.deleteText(insertIndex, '[图片上传中...]'.length);
    alert('上传失败，请检查网络或稍后重试');
  }
}

function imageHandler() {
  var input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.onchange = function () {
    var file = input.files[0];
    if (file) uploadAndInsertImage(file);
  };
}

// ====================== 文件上传 ======================
function fileHandler() {
  var input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.click();

  input.onchange = async function () {
    var file = input.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(i18next.t('alert.file_limit') || '文件大小不能超过 20MB');
      return;
    }

    var range = quill.getSelection(true);
    var uploadingText = (i18next.t('alert.file_uploading') || '[上传中...] ') + file.name;

    quill.insertText(range.index, uploadingText, { color: '#999' });

    var formData = new FormData();
    formData.append('file', file);

    try {
      var response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      });

      var data = await response.json();
      quill.deleteText(range.index, uploadingText.length);

      if (data.success && data.url) {
        var insertText = '📎 ' + file.name;
        quill.insertText(range.index, insertText);
        quill.setSelection(range.index, insertText.length);
        quill.format('link', data.url);
        quill.setSelection(range.index + insertText.length);
        quill.format('link', false);
        quill.insertText(range.index + insertText.length, ' ');
      } else {
        alert((i18next.t('alert.file_fail') || '文件上传失败：') + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('文件上传出错', error);
      quill.deleteText(range.index, uploadingText.length);
      alert('上传失败，请检查网络或稍后重试');
    }
  };
}

// ====================== 步骤条渲染 ======================
function renderStepper() {
  var container = document.getElementById('stepperContainer');
  container.innerHTML = '';

  STEPS_NAME.forEach(function (title, index) {
    var isLocked = index > state.maxStepIndex;
    var isActiveView = index === state.activeStepIndex;

    var node = document.createElement('div');
    var classNames = ['step-node'];

    if (isLocked) {
      classNames.push('locked');
    } else if (isActiveView) {
      classNames.push('active');
    } else {
      classNames.push('completed');
    }

    node.className = classNames.join(' ');
    var translatedTitle = i18next.t('step.' + title);
    node.innerHTML = '<div class="step-oval">' + translatedTitle + '</div>';

    if (!isLocked) {
      (function (idx) {
        node.onclick = function () {
          state.activeStepIndex = idx;
          renderStepper();
          renderTimeline();
          if (window.innerWidth <= 768) {
            node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        };
      })(index);
    }

    container.appendChild(node);

    if (index < STEPS_NAME.length - 1) {
      var line = document.createElement('div');
      var lineClass = 'step-line';
      if (index < state.maxStepIndex) lineClass += ' completed';
      else if (index === state.maxStepIndex) lineClass += ' half-active';
      line.className = lineClass;
      container.appendChild(line);
    }
  });

  var nextContainer = document.getElementById('nextStepContainer');
  if (BACKEND_DATA.role === 'read' || state.maxStepIndex >= STEPS_NAME.length - 1 || state.activeStepIndex !== state.maxStepIndex) {
    nextContainer.style.display = 'none';
  } else {
    nextContainer.style.display = 'flex';
  }
}

// ====================== 时间线渲染 ======================
function renderTimeline() {
  var stepId = STEPS_ID[state.activeStepIndex];
  var records = state.nodesData[stepId] || [];

  if (stepId === 'requirement') {
    var creationRecords = records.filter(function (r) { return r.time && r.time.includes('项目创建'); });
    var otherRecords = records.filter(function (r) { return !r.time || !r.time.includes('项目创建'); });
    records = creationRecords.concat(otherRecords);
  }

  var container = document.getElementById('timelineContainer');
  if (records.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#ccc; padding:20px;">' + i18next.t('timeline.no_records') + '</p>';
    return;
  }

  container.innerHTML = records.slice().reverse().map(function (item) {
    var displayTime = item.time || i18next.t('timeline.early');
    if (displayTime !== i18next.t('timeline.early') && !displayTime.includes('UTC+8') && !displayTime.match(/[a-zA-Z]/)) {
      displayTime += ' (UTC+8)';
    }

    var extraClass = '';
    if (displayTime.includes('项目创建')) extraClass = 'starting-record';

    var isAdmin = BACKEND_DATA.role === 'admin';
    var isSystemRecord = displayTime.includes('项目创建') ||
      displayTime.includes('订单详情') ||
      displayTime.includes('系统日志') ||
      (item.html && item.html.includes('【系统通知】'));
    var canDelete = isAdmin && !isSystemRecord;

    var originalIndex = state.nodesData[stepId].indexOf(item);

    var deleteBtnHtml = canDelete
      ? '<button class="btn-delete-record" onclick="deleteRecord(\'' + stepId + '\', ' + originalIndex + ')">删除</button>'
      : '';

    return '<div class="timeline-item ' + extraClass + '">' +
      '<div class="timeline-divider"><div class="timeline-dot"></div></div>' +
      '<div class="timeline-content" style="position: relative;">' +
      deleteBtnHtml +
      '<div class="timeline-time">' + displayTime + '</div>' +
      '<div class="timeline-html">' + (item.html || '') + '</div>' +
      '</div></div>';
  }).join('');
}

// ====================== 删除记录 ======================
window.deleteRecord = async function (stepId, recordIndex) {
  if (!confirm("确认删除这条记录吗？此操作无法恢复。")) return;

  try {
    var payload = {
      projectId: PROJECT_ID,
      stepId: stepId,
      recordIndex: recordIndex,
      newRecord: state.nodesData[stepId][recordIndex],
      action: "delete_record"
    };

    var res = await fetch('/api/append-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var data = await res.json();

    if (data.success) {
      state.nodesData[stepId].splice(recordIndex, 1);
      renderTimeline();
    } else {
      throw new Error(data.message || "n8n 返回失败");
    }
  } catch (e) {
    console.error("请求失败", e);
    alert("删除失败，请稍后重试");
  }
};

// ====================== DOM 就绪后的事件绑定 ======================
document.addEventListener('DOMContentLoaded', function () {
  initI18next();

  var savedToken = localStorage.getItem(STORAGE_KEY);
  if (savedToken) {
    document.getElementById('verifyBtn').innerText = i18next.t('default.verifying');
    verifyToken(savedToken, true);
  }

  // 语言切换
  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var newLang = btn.dataset.lang;
      i18next.changeLanguage(newLang, function () {
        localStorage.setItem(LANG_STORAGE_KEY, newLang);
        updateAllContent();
        highlightActiveLangButton();
        if (state.nodesData) {
          renderProjectDates();
          renderStepper();
          renderTimeline();
        }
      });
    });
  });

  // 验证按钮
  document.getElementById('verifyBtn').addEventListener('click', function () {
    var token = document.getElementById('tokenInput').value.trim();
    if (token) verifyToken(token, false);
  });

  // Token 输入框回车
  document.getElementById('tokenInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      var token = this.value.trim();
      if (token) verifyToken(token, false);
    }
  });

  // 保存记录
  document.getElementById('submitBtn').addEventListener('click', async function () {
    if (BACKEND_DATA.role === 'read') return;
    if (!quill) return;

    if (quill.getLength() <= 1 && !quill.root.innerHTML.includes('<img')) {
      alert(i18next.t('alert.empty') || "内容为空");
      return;
    }

    var html = quill.root.innerHTML;
    var stepId = STEPS_ID[state.activeStepIndex];
    var time = formatNowTime();
    var newRecord = { time: time, html: html };

    if (!state.nodesData[stepId]) state.nodesData[stepId] = [];
    state.nodesData[stepId].push(newRecord);
    quill.setContents([{ insert: '\n' }]);
    renderTimeline();

    var btn = document.getElementById('submitBtn');
    var originalText = btn.innerText;
    btn.innerText = "保存中...";
    btn.disabled = true;

    try {
      var res = await fetch('/api/append-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: PROJECT_ID, stepId: stepId, newRecord: newRecord })
      });

      var data = await res.json();
      if (data.success) {
        btn.innerText = "已保存 ✓";
        setTimeout(function () {
          btn.innerText = originalText;
          btn.disabled = false;
        }, 1200);
      } else {
        throw new Error("保存失败");
      }
    } catch (e) {
      alert(i18next.t('alert.save_fail') || "保存失败");
      state.nodesData[stepId].pop();
      renderTimeline();
      btn.innerText = originalText;
      btn.disabled = false;
    }
  });

  // 完成阶段
  document.getElementById('nextStepBtn').addEventListener('click', async function () {
    if (BACKEND_DATA.role !== 'write' && BACKEND_DATA.role !== 'admin') return;
    if (state.activeStepIndex !== state.maxStepIndex) return;

    var confirmed = confirm(i18next.t('confirm.complete_stage') || "确认提交\u201c此阶段已完成\u201d？\n此操作将通知管理员，正在更新项目进展。");
    if (!confirmed) return;

    var btn = document.getElementById('nextStepBtn');
    var originalText = btn.innerText;
    btn.innerText = "处理中...";
    btn.style.pointerEvents = "none";

    var payload = {
      projectId: PROJECT_ID,
      stepId: STEPS_ID[state.maxStepIndex],
      newRecord: {
        time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + ' (UTC+8)',
        html: '<p style="color:#aa0000; font-weight:bold;">【系统通知】此阶段已完成，已通知管理员更新进展</p>'
      },
      action: "complete_current_stage"
    };

    try {
      var res = await fetch('/api/append-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json();
      if (data.success) {
        alert(i18next.t('alert.complete_success') || "已通知管理员，正在更新项目进展");
        btn.innerText = "已提交完成";
        btn.style.color = "#888";
        btn.style.pointerEvents = "none";
      } else {
        throw new Error("n8n 返回失败");
      }
    } catch (e) {
      console.error("请求失败", e);
      alert(i18next.t('alert.complete_fail') || "通知管理员失败，请稍后重试");
      btn.innerText = originalText;
      btn.style.pointerEvents = "auto";
    }
  });

  // 图片预览点击
  document.getElementById('timelineContainer').addEventListener('click', function (e) {
    if (e.target.tagName === 'IMG') {
      var gallery = e.target.closest('.img-gallery');
      if (gallery) {
        currentImageList = Array.from(gallery.querySelectorAll('img')).map(function (img) { return img.src; });
        currentIndex = currentImageList.indexOf(e.target.src);
      } else {
        currentImageList = [e.target.src];
        currentIndex = 0;
      }
      openImagePreview();
    }
  });

  // 键盘导航（图片预览）
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('imagePreviewModal');
    if (modal.style.display === 'flex') {
      if (e.key === 'ArrowLeft') changeImage(-1);
      if (e.key === 'ArrowRight') changeImage(1);
      if (e.key === 'Escape') closeImagePreview();
    }
  });

  // 年份
  document.getElementById('currentYear').innerText = new Date().getFullYear();

  // ====================== 邮件通知弹窗 ======================
  var emailModal = document.getElementById('emailModal');
  var emailNotifyBtn = document.getElementById('emailNotifyBtn');
  var emailCancelBtn = document.getElementById('emailCancelBtn');
  var emailConfirmBtn = document.getElementById('emailConfirmBtn');
  var emailAddresses = document.getElementById('emailAddresses');
  var emailContent = document.getElementById('emailContent');
  var emailError = document.getElementById('emailError');

  if (emailNotifyBtn) {
    emailNotifyBtn.addEventListener('click', function () {
      emailAddresses.value = '';
      emailContent.value = '';
      emailError.style.display = 'none';
      emailConfirmBtn.disabled = false;
      emailConfirmBtn.innerText = i18next.t('email.confirm');
      emailModal.style.display = 'flex';
    });
  }

  if (emailCancelBtn) {
    emailCancelBtn.addEventListener('click', function () {
      emailModal.style.display = 'none';
    });
  }

  if (emailConfirmBtn) {
    emailConfirmBtn.addEventListener('click', async function () {
      emailError.style.display = 'none';

      var rawText = emailAddresses.value.trim();
      if (!rawText) {
        emailError.innerText = i18next.t('email.error_empty');
        emailError.style.display = 'block';
        return;
      }

      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      var emails = rawText.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);

      if (emails.length === 0) {
        emailError.innerText = i18next.t('email.error_empty');
        emailError.style.display = 'block';
        return;
      }

      for (var i = 0; i < emails.length; i++) {
        if (!emailRegex.test(emails[i])) {
          emailError.innerText = i18next.t('email.error_invalid') + ': ' + emails[i];
          emailError.style.display = 'block';
          return;
        }
      }

      emailConfirmBtn.disabled = true;
      emailConfirmBtn.innerText = i18next.t('email.sending');

      try {
        var res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: PROJECT_ID,
            emails: emails,
            content: emailContent.value.trim()
          })
        });

        var data = await res.json();
        if (data.success) {
          alert(i18next.t('email.success'));
          emailModal.style.display = 'none';
        } else {
          throw new Error(data.message);
        }
      } catch (e) {
        console.error('邮件发送失败', e);
        emailError.innerText = i18next.t('email.fail');
        emailError.style.display = 'block';
        emailConfirmBtn.disabled = false;
        emailConfirmBtn.innerText = i18next.t('email.confirm');
      }
    });
  }
});
