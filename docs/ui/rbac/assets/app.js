/* 辰光 Agent 平台 · RBAC 原型运行时
   权限模型与视觉呈现的共享层：身份、菜单过滤、页面守卫、权限注记。 */
(function () {
  'use strict';

  var IDENTITIES = {
    admin: {
      key: 'admin',
      name: '周正',
      initials: '周',
      roleLabel: '超级管理员',
      email: 'zhou.zheng@chenguang.local',
      isSuperuser: true,
      roles: [{ code: 'admin', name: '管理员' }],
      dataScope: 'all',
      permissions: ['*'],
      summary: '全部数据，全部功能权限'
    },
    operator: {
      key: 'operator',
      name: '林晓',
      initials: '林',
      roleLabel: '运营人员',
      email: 'lin.xiao@chenguang.local',
      isSuperuser: false,
      roles: [{ code: 'operator', name: '运营人员' }],
      dataScope: 'self',
      permissions: [
        'agent:*', 'prompt:*', 'knowledge:*', 'tool:*',
        'model:list', 'model:read', 'provider:list', 'provider:read'
      ],
      summary: '仅本人数据与公开资源，业务模块全权'
    },
    viewer: {
      key: 'viewer',
      name: '陈默',
      initials: '陈',
      roleLabel: '只读访客',
      email: 'chen.mo@chenguang.local',
      isSuperuser: false,
      roles: [{ code: 'viewer', name: '只读访客' }],
      dataScope: 'self',
      permissions: [
        'agent:list', 'agent:read', 'prompt:list', 'prompt:read',
        'knowledge:list', 'knowledge:read', 'tool:list', 'tool:read',
        'model:list', 'model:read', 'provider:list', 'provider:read'
      ],
      summary: '仅本人数据与公开资源，只读'
    }
  };

  var PERMISSIONS = [
    { module: 'user', name: '用户管理', perms: [
      ['user:list', '查看用户列表', 'GET /users', 2],
      ['user:read', '查看用户详情', 'GET /users/{id}', 2],
      ['user:create', '创建用户', 'POST /users', 1],
      ['user:delete', '删除用户', 'DELETE /users/{id}', 1],
      ['user:assign_role', '分配用户角色', 'PUT /users/{id}/roles', 1]
    ]},
    { module: 'role', name: '角色管理', perms: [
      ['role:list', '查看角色列表', 'GET /roles', 2],
      ['role:read', '查看角色详情', 'GET /roles/{id}', 2],
      ['role:create', '创建角色', 'POST /roles', 1],
      ['role:update', '修改角色', 'PUT /roles/{id}', 1],
      ['role:delete', '删除角色', 'DELETE /roles/{id}', 1],
      ['role:assign_perm', '分配角色权限', 'PUT /roles/{id}/permissions', 1]
    ]},
    { module: 'permission', name: '权限管理', perms: [
      ['permission:list', '查看权限列表', 'GET /permissions', 1],
      ['permission:read', '查看权限详情', 'GET /permissions/{id}', 1],
      ['permission:create', '创建权限', 'POST /permissions', 1],
      ['permission:update', '修改权限', 'PUT /permissions/{id}', 1],
      ['permission:delete', '删除权限', 'DELETE /permissions/{id}', 1]
    ]},
    { module: 'agent', name: 'Agent 管理', perms: [
      ['agent:list', '查看 Agent 列表', 'GET /agents', 3],
      ['agent:read', '查看 Agent 详情', 'GET /agents/{id}', 3],
      ['agent:create', '创建 Agent', 'POST /agents', 2],
      ['agent:update', '修改 Agent', 'PUT /agents/{id}', 2],
      ['agent:delete', '删除 Agent', 'DELETE /agents/{id}', 1],
      ['agent:publish', '发布 Agent', 'POST /agents/{id}/publish', 2],
      ['agent:rollback', '回滚 Agent 版本', 'POST /agents/{id}/rollback', 1],
      ['agent:start', '启动 Agent', 'POST /agents/{id}/start', 2],
      ['agent:stop', '停止 Agent', 'POST /agents/{id}/stop', 2]
    ]},
    { module: 'prompt', name: 'Prompt 管理', perms: [
      ['prompt:list', '查看 Prompt 列表', 'GET /prompts', 3],
      ['prompt:read', '查看 Prompt 详情', 'GET /prompts/{id}', 3],
      ['prompt:create', '创建 Prompt', 'POST /prompts', 2],
      ['prompt:update', '修改 Prompt', 'PUT /prompts/{id}', 2],
      ['prompt:delete', '删除 Prompt', 'DELETE /prompts/{id}', 1],
      ['prompt:publish', '发布 Prompt', 'POST /prompts/{id}/publish', 2],
      ['prompt:rollback', '回滚 Prompt 版本', 'POST /prompts/{id}/rollback', 1]
    ]},
    { module: 'knowledge', name: '知识库管理', perms: [
      ['knowledge:list', '查看知识库列表', 'GET /knowledge-bases', 3],
      ['knowledge:read', '查看知识库详情', 'GET /knowledge-bases/{id}', 3],
      ['knowledge:create', '创建知识库', 'POST /knowledge-bases', 2],
      ['knowledge:update', '修改知识库', 'PUT /knowledge-bases/{id}', 2],
      ['knowledge:delete', '删除知识库', 'DELETE /knowledge-bases/{id}', 1],
      ['knowledge:document_upload', '上传文档', 'POST /{id}/documents', 2],
      ['knowledge:document_delete', '删除文档', 'DELETE /{id}/documents/{doc_id}', 1],
      ['knowledge:document_retry', '重试文档解析', 'POST /{id}/documents/{doc_id}/retry', 2],
      ['knowledge:segment_update', '修改文档分段', 'PUT /{id}/segments/{seg_id}', 2],
      ['knowledge:segment_delete', '删除文档分段', 'DELETE /{id}/segments/{seg_id}', 1],
      ['knowledge:retrieve', '知识库检索测试', 'POST /{id}/retrieval-test', 2]
    ]},
    { module: 'tool', name: '工具管理', perms: [
      ['tool:list', '查看工具列表', 'GET /tools', 3],
      ['tool:read', '查看工具详情', 'GET /tools/{id}', 3],
      ['tool:create', '创建工具', 'POST /tools', 2],
      ['tool:update', '修改工具', 'PUT /tools/{id}', 2],
      ['tool:delete', '删除工具', 'DELETE /tools/{id}', 1],
      ['tool:enable', '启用工具', 'POST /tools/{id}/enable', 2],
      ['tool:disable', '停用工具', 'POST /tools/{id}/disable', 2],
      ['tool:test', '测试工具', 'POST /tools/{id}/test', 2]
    ]},
    { module: 'provider', name: '模型供应商', perms: [
      ['provider:list', '查看供应商列表', 'GET /providers', 2],
      ['provider:read', '查看供应商详情', 'GET /providers/{id}', 2],
      ['provider:create', '创建供应商', 'POST /providers', 1],
      ['provider:update', '修改供应商', 'PUT /providers/{id}', 1],
      ['provider:delete', '删除供应商', 'DELETE /providers/{id}', 1],
      ['provider:test', '测试供应商连接', 'POST /providers/{id}/test', 1]
    ]},
    { module: 'model', name: '模型管理', perms: [
      ['model:list', '查看模型列表', 'GET /models', 3],
      ['model:read', '查看模型详情', 'GET /models/{id}', 3],
      ['model:create', '创建模型', 'POST /models', 1],
      ['model:update', '修改模型', 'PUT /models/{id}', 1],
      ['model:delete', '删除模型', 'DELETE /models/{id}', 1]
    ]},
    { module: 'conversation', name: '对话日志（预留）', perms: [
      ['conversation:list', '查看对话列表', 'GET /conversations', 0],
      ['conversation:read', '查看对话详情', 'GET /conversations/{id}', 0],
      ['conversation:export', '导出对话记录', '—', 0]
    ]},
    { module: 'analytics', name: '数据统计（预留）', perms: [
      ['analytics:usage', '查看用量统计', 'GET /analytics/usage', 0],
      ['analytics:cost', '查看费用分析', 'GET /analytics/costs', 0],
      ['analytics:evaluation', '查看效果评估', 'GET /analytics/evaluation', 0]
    ]},
    { module: 'system', name: '系统管理（预留）', perms: [
      ['system:apikey_manage', '管理 API 密钥', '—', 0],
      ['system:audit_read', '查看审计日志', '—', 1],
      ['system:alert_manage', '管理告警规则', '—', 0],
      ['system:settings_manage', '管理系统配置', '—', 0]
    ]}
  ];

  var MODULE_NAMES = {};
  PERMISSIONS.forEach(function (g) { MODULE_NAMES[g.module] = g.name; });

  var AGENTS = [
    { id: 'agt-1042', name: '智能客服 Agent', type: '对话型', status: 'running', owner: '周正', ownerId: 'u-1', visibility: 'public', version: 'v2.3', success: '98.5%', calls: 12847, updated: '2026-10-24 16:20', model: 'Qwen2.5-72B' },
    { id: 'agt-1038', name: '代码审查 Agent', type: '工具型', status: 'running', owner: '林晓', ownerId: 'u-2', visibility: 'private', version: 'v1.2', success: '97.1%', calls: 8234, updated: '2026-10-24 11:05', model: 'DeepSeek-V3' },
    { id: 'agt-1031', name: '数据分析 Agent', type: '分析型', status: 'stopped', owner: '周正', ownerId: 'u-1', visibility: 'public', version: 'v1.1', success: '95.2%', calls: 5632, updated: '2026-10-23 15:48', model: 'Qwen2.5-72B' },
    { id: 'agt-1027', name: '翻译助手 Agent', type: '创作型', status: 'error', owner: '陈默', ownerId: 'u-3', visibility: 'private', version: 'v1.0', success: '99.1%', calls: 4521, updated: '2026-10-22 09:33', model: 'DeepSeek-V3' },
    { id: 'agt-1019', name: '内容生成 Agent', type: '创作型', status: 'running', owner: '林晓', ownerId: 'u-2', visibility: 'public', version: 'v0.9', success: '92.8%', calls: 3876, updated: '2026-10-21 17:12', model: 'Qwen2.5-32B' },
    { id: 'agt-1012', name: '工单分派 Agent', type: '工具型', status: 'draft', owner: '赵岚', ownerId: 'u-4', visibility: 'private', version: 'v0.3', success: '—', calls: 0, updated: '2026-10-20 10:02', model: 'DeepSeek-V3' }
  ];

  var USERS = [
    { id: 'u-1', name: '周正', email: 'zhou.zheng@chenguang.local', roles: ['管理员'], superuser: true, active: true, last: '2026-10-25 09:12' },
    { id: 'u-2', name: '林晓', email: 'lin.xiao@chenguang.local', roles: ['运营人员'], superuser: false, active: true, last: '2026-10-25 08:47' },
    { id: 'u-3', name: '陈默', email: 'chen.mo@chenguang.local', roles: ['只读访客'], superuser: false, active: true, last: '2026-10-24 16:08' },
    { id: 'u-4', name: '赵岚', email: 'zhao.lan@chenguang.local', roles: ['运营人员'], superuser: false, active: false, last: '2026-10-18 14:21' },
    { id: 'u-5', name: '苏棠', email: 'su.tang@chenguang.local', roles: ['运营人员'], superuser: false, active: true, last: '2026-10-24 10:56' }
  ];

  var ROLES = [
    { code: 'admin', name: '管理员', scope: 'all', users: 1, perms: 72, builtin: true, note: '系统内置，不可删除、不可修改数据范围' },
    { code: 'operator', name: '运营人员', scope: 'self', users: 3, perms: 39, builtin: false, note: '默认角色，业务模块全权，系统管理无权限' },
    { code: 'viewer', name: '只读访客', scope: 'self', users: 1, perms: 12, builtin: false, note: '自定义角色，仅授予 list / read' }
  ];

  var AUDIT = [
    { time: '2026-10-25 09:41', actor: '周正', action: '授予角色权限', target: '运营人员', before: '未授予', after: 'knowledge:document_retry', ip: '10.20.3.18' },
    { time: '2026-10-24 18:12', actor: '周正', action: '分配用户角色', target: '陈默', before: '—', after: '只读访客', ip: '10.20.3.18' },
    { time: '2026-10-24 16:30', actor: '周正', action: '修改数据范围', target: '运营人员', before: '全部数据', after: '仅本人数据', ip: '10.20.3.11' },
    { time: '2026-10-23 11:08', actor: '周正', action: '创建权限', target: 'system:audit_read', before: '—', after: '已创建', ip: '10.20.3.18' },
    { time: '2026-10-21 15:44', actor: '林晓', action: '越权授权被拒', target: 'user:delete', before: '40303', after: '已拒绝', ip: '10.20.3.26' }
  ];

  var NAV = [
    { group: '工作台', items: [
      { key: 'dashboard', label: '工作台', href: 'dashboard.html' }
    ]},
    { group: '平台', items: [
      { key: 'agents', label: 'Agent 管理', href: 'agents.html', perm: 'agent:list' },
      { key: 'models', label: '模型管理', href: 'models.html', permAny: ['model:list', 'provider:list'], todo: true },
      { key: 'prompts', label: 'Prompt 管理', href: 'prompts.html', perm: 'prompt:list', todo: true },
      { key: 'knowledge', label: '知识库管理', href: 'knowledge.html', perm: 'knowledge:list', todo: true },
      { key: 'tools', label: '工具管理', href: 'tools.html', perm: 'tool:list', todo: true },
      { key: 'conversations', label: '对话日志', href: 'conversations.html', perm: 'conversation:list', todo: true },
      { key: 'analytics', label: '数据统计', href: 'analytics.html', permAny: ['analytics:usage', 'analytics:cost', 'analytics:evaluation'], todo: true }
    ]},
    { group: '系统管理', items: [
      { key: 'users', label: '用户管理', href: 'users.html', perm: 'user:list' },
      { key: 'roles', label: '角色管理', href: 'roles.html', perm: 'role:list' },
      { key: 'permissions', label: '权限管理', href: 'permissions.html', perm: 'permission:list' },
      { key: 'audit', label: '审计日志', href: 'audit.html', perm: 'system:audit_read' },
      { key: 'api-keys', label: 'API 密钥', href: 'api-keys.html', perm: 'system:apikey_manage', todo: true },
      { key: 'alerts', label: '告警规则', href: 'alerts.html', perm: 'system:alert_manage', todo: true },
      { key: 'settings', label: '系统配置', href: 'settings.html', perm: 'system:settings_manage', todo: true }
    ]}
  ];

  var params = new URLSearchParams(window.location.search);
  var storedRole = null;
  try { storedRole = window.sessionStorage.getItem('cg-role'); } catch (e) { /* file:// 下可能不可用 */ }
  var roleKey = params.get('role') || storedRole || 'admin';
  if (!IDENTITIES[roleKey]) roleKey = 'admin';
  var me = IDENTITIES[roleKey];
  try { window.sessionStorage.setItem('cg-role', roleKey); } catch (e) { /* ignore */ }

  function can(code) {
    if (!code) return true;
    if (me.isSuperuser) return true;
    var list = me.permissions;
    if (list.indexOf('*') !== -1) return true;
    if (list.indexOf(code) !== -1) return true;
    var mod = String(code).split(':')[0];
    if (list.indexOf(mod + ':*') !== -1) return true;
    return false;
  }

  function canAny(codes) {
    if (!codes || !codes.length) return true;
    return codes.some(can);
  }

  function canAll(codes) {
    return (codes || []).every(can);
  }

  function canRead(res) {
    if (me.isSuperuser) return true;
    if (me.dataScope === 'all') return true;
    if (!res) return false;
    return res.visibility === 'public' || res.ownerId === 'u-' + (me.key === 'admin' ? 1 : me.key === 'operator' ? 2 : 3);
  }

  function canWrite(res) {
    if (me.isSuperuser) return true;
    if (me.dataScope === 'all') return true;
    if (!res) return false;
    return res.ownerId === 'u-' + (me.key === 'admin' ? 1 : me.key === 'operator' ? 2 : 3);
  }

  function isMine(res) {
    return !!res && res.ownerId === 'u-' + (me.key === 'admin' ? 1 : me.key === 'operator' ? 2 : 3);
  }

  function fmt(n) {
    return Number(n).toLocaleString('zh-CN');
  }

  function scopeLabel(scope) {
    return scope === 'all' ? '全部数据' : '仅本人数据';
  }

  function visibilityTag(v) {
    return v === 'public'
      ? '<span class="tag tag-public">公开</span>'
      : '<span class="tag tag-private">私有</span>';
  }

  function statusTag(s) {
    var map = {
      running: ['运行中', 'state-running'],
      stopped: ['已停止', 'state-stopped'],
      draft: ['草稿', 'state-draft'],
      error: ['异常', 'state-error']
    };
    var it = map[s] || ['草稿', 'state-draft'];
    return '<span class="dot-state ' + it[1] + '">' + it[0] + '</span>';
  }

  function roleTag(r) {
    return '<span class="tag tag-neutral">' + r + '</span>';
  }

  function permissionStats() {
    if (me.isSuperuser) {
      return { label: '全局通配 *', count: 72 };
    }
    var wild = 0, exact = 0;
    me.permissions.forEach(function (p) {
      if (p === '*') wild++;
      else if (p.slice(-2) === ':*') wild++;
      else exact++;
    });
    var label = wild && exact
      ? wild + ' 个模块通配 + ' + exact + ' 项精确'
      : wild ? wild + ' 个模块通配' : exact + ' 项精确';
    return { label: label, count: wild + exact };
  }

  function pageRequirement() {
    var req = document.body.getAttribute('data-requires');
    return req || '';
  }

  function hrefWithRole(href, extra) {
    var url = href;
    var q = 'role=' + encodeURIComponent(roleKey);
    if (extra) q = extra + '&' + q;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + q;
  }

  function navAllowed(item) {
    if (item.perm) return can(item.perm);
    if (item.permAny) return canAny(item.permAny);
    return true;
  }

  function renderRail() {
    var rail = document.getElementById('rail');
    if (!rail) return;
    var current = document.body.getAttribute('data-page');
    var html = '' +
      '<div class="rail-brand">' +
        '<div class="name"><span class="mark"></span>辰光 Agent<small>CHENGUANG / ACCESS CONSOLE</small></div>' +
      '</div>' +
      '<nav class="rail-nav" aria-label="主导航">';
    NAV.forEach(function (group) {
      var visible = group.items.filter(navAllowed);
      if (!visible.length) return;
      html += '<div class="nav-group"><div class="nav-group-title">' + group.group + '</div>';
      visible.forEach(function (item) {
        var isCurrent = item.key === current;
        html += '<a class="nav-item" href="' + hrefWithRole(item.href) + '"' +
          (isCurrent ? ' aria-current="page"' : '') +
          (item.todo ? ' data-todo="1" title="本页不在本次 RBAC 原型范围内"' : '') +
          '>' +
          '<span>' + item.label + '</span>' +
          (item.todo ? '<span class="nav-flag">原型</span>' : '') +
          '</a>';
      });
      html += '</div>';
    });
    html += '</nav>' +
      '<div class="rail-foot">' +
        '<div class="rail-user">' +
          '<div class="avatar" aria-hidden="true">' + me.initials + '</div>' +
          '<div class="who"><b>' + me.name + '</b><span>' + me.roleLabel + '</span></div>' +
        '</div>' +
        '<button class="rail-signout" type="button" data-signout>退出登录</button>' +
      '</div>';
    rail.innerHTML = html;

    rail.querySelectorAll('[data-todo]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        toast('「' + a.querySelector('span').textContent + '」不在本次 RBAC 原型范围内');
      });
    });
    var out = rail.querySelector('[data-signout]');
    if (out) out.addEventListener('click', function () { toast('原型演示：退出后回到登录页'); });
  }

  function renderBoundary() {
    var el = document.getElementById('boundary');
    if (!el) return;
    var req = pageRequirement();
    var stats = permissionStats();
    var reqState;
    if (!req) {
      reqState = '<span class="boundary-state"><span class="dot"></span>登录即可访问</span>';
    } else if (can(req)) {
      reqState = '<span class="boundary-state"><span class="dot"></span>本页需要 <span class="mono">&nbsp;' + req + '&nbsp;</span> 已授予</span>';
    } else {
      reqState = '<span class="boundary-state denied"><span class="dot"></span>本页需要 <span class="mono">&nbsp;' + req + '&nbsp;</span> 未授予</span>';
    }
    el.innerHTML = '' +
      '<div class="boundary-tag">授权边界</div>' +
      '<div class="boundary-item"><span class="k">身份</span><span class="v">' + me.name + ' / ' + me.roleLabel + '</span></div>' +
      '<div class="boundary-item"><span class="k">数据范围</span><span class="v">' + scopeLabel(me.dataScope) + '</span></div>' +
      '<div class="boundary-item optional"><span class="k">功能权限</span><span class="v mono">' + stats.label + '</span></div>' +
      '<div class="boundary-spacer"></div>' +
      reqState;
  }

  function renderTopbar() {
    var el = document.getElementById('topbar');
    if (!el) return;
    var title = document.body.getAttribute('data-title') || document.title;
    var group = document.body.getAttribute('data-group') || '';
    var crumbGroup = group ? '<span class="sep">/</span><span class="muted">' + group + '</span>' : '';
    el.innerHTML = '' +
      '<button class="rail-toggle" type="button" aria-label="打开菜单" aria-expanded="false" data-rail-toggle><span></span></button>' +
      '<nav class="crumbs" aria-label="面包屑">' +
        '<a href="' + hrefWithRole('dashboard.html') + '">首页</a>' +
        crumbGroup +
        '<span class="sep">/</span><span class="here">' + title + '</span>' +
      '</nav>' +
      '<div class="topbar-right">' +
        '<div class="preview" data-preview>' +
          '<button class="preview-trigger" type="button" aria-expanded="false" aria-haspopup="true" data-preview-trigger>' +
            '<span class="preview-k">预览身份</span>' +
            '<span class="preview-v">' + me.name + ' / ' + me.roleLabel + '</span>' +
            '<span class="chev" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="preview-menu" role="menu" hidden data-preview-menu>' +
            '<p class="preview-hint">切换身份，检查菜单、按钮与数据边界如何变化。</p>' +
            Object.keys(IDENTITIES).map(function (key) {
              var p = IDENTITIES[key];
              return '<button class="preview-item" type="button" role="menuitemradio" aria-checked="' + (key === roleKey) + '" data-role="' + key + '">' +
                '<span class="pi-top"><span class="pi-name">' + p.name + '</span><span class="pi-role">' + p.roleLabel + '</span></span>' +
                '<span class="pi-meta">' + p.roles.map(function (r) { return r.code; }).join(', ') + ' / ' + (p.dataScope === 'all' ? 'all' : 'self') + '</span>' +
                '<span class="pi-meta pi-scope">' + p.summary + '</span>' +
              '</button>';
            }).join('') +
            '<p class="preview-foot">原型评审控件，不改变真实权限。</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    var toggle = el.querySelector('[data-rail-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = document.body.classList.toggle('rail-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    var pv = el.querySelector('[data-preview]');
    var trigger = el.querySelector('[data-preview-trigger]');
    var menu = el.querySelector('[data-preview-menu]');
    function closeMenu() {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
    trigger.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (ev) {
      if (!pv.contains(ev.target)) closeMenu();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeMenu();
    });
    el.querySelectorAll('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('data-role');
        try { window.sessionStorage.setItem('cg-role', next); window.sessionStorage.setItem('cg-switched', '1'); } catch (e) { /* ignore */ }
        var url = new URL(window.location.href);
        url.searchParams.set('role', next);
        window.location.href = url.toString();
      });
    });
  }

  function guard() {
    var req = pageRequirement();
    if (!req || can(req)) return true;
    var from = window.location.pathname.split('/').pop() || 'index.html';
    var url = 'forbidden.html?denied=' + encodeURIComponent(req) +
      '&from=' + encodeURIComponent(from) +
      '&role=' + encodeURIComponent(roleKey);
    window.location.replace(url);
    return false;
  }

  var toastTimer = null;
  function toast(message) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    var focusable = m.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus();
  }

  function closeModal(id) {
    var m = document.getElementById(id);
    if (m) m.hidden = true;
  }

  function applyPermissions() {
    document.querySelectorAll('[data-perm]').forEach(function (el) {
      if (!can(el.getAttribute('data-perm'))) el.remove();
    });
    document.querySelectorAll('[data-perm-any]').forEach(function (el) {
      var codes = el.getAttribute('data-perm-any').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!canAny(codes)) el.remove();
    });
    document.querySelectorAll('[data-perm-all]').forEach(function (el) {
      var codes = el.getAttribute('data-perm-all').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!canAll(codes)) el.remove();
    });
  }

  function expandPermissions(list) {
    var out = [];
    list.forEach(function (p) {
      if (p.slice(-2) === ':*') {
        var mod = p.slice(0, -2);
        out = out.concat(expandedModule(mod));
      } else if (p !== '*') {
        out.push(p);
      }
    });
    return out;
  }

  function expandedModule(mod) {
    var group = PERMISSIONS.filter(function (g) { return g.module === mod; })[0];
    return group ? group.perms.map(function (p) { return p[0]; }) : [];
  }

  function hasExpanded(code) {
    if (me.isSuperuser) return true;
    return can(code);
  }

  // ---- shell boot ----
  var isShell = !!document.getElementById('rail');
  if (isShell) {
    if (!guard()) return;
    renderRail();
    renderBoundary();
    renderTopbar();
    if (window.sessionStorage.getItem('cg-switched') === '1') {
      document.body.classList.add('just-switched');
      window.setTimeout(function () {
        document.body.classList.remove('just-switched');
        try { window.sessionStorage.removeItem('cg-switched'); } catch (e) { /* ignore */ }
      }, 900);
    }
    applyPermissions();
    window.addEventListener('load', applyPermissions);
  }

  window.CG = {
    identities: IDENTITIES,
    me: me,
    roleKey: roleKey,
    permissions: PERMISSIONS,
    moduleNames: MODULE_NAMES,
    agents: AGENTS,
    users: USERS,
    roles: ROLES,
    audit: AUDIT,
    can: can,
    canAny: canAny,
    canAll: canAll,
    canRead: canRead,
    canWrite: canWrite,
    isMine: isMine,
    fmt: fmt,
    scopeLabel: scopeLabel,
    visibilityTag: visibilityTag,
    statusTag: statusTag,
    roleTag: roleTag,
    permissionStats: permissionStats,
    hrefWithRole: hrefWithRole,
    expandPermissions: expandPermissions,
    expandedModule: expandedModule,
    hasExpanded: hasExpanded,
    applyPermissions: applyPermissions,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    switchRole: function (key) {
      var url = new URL(window.location.href);
      url.searchParams.set('role', key);
      try { window.sessionStorage.setItem('cg-switched', '1'); } catch (e) { /* ignore */ }
      window.location.href = url.toString();
    }
  };
})();
