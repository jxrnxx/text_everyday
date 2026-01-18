---@diagnostic disable: undefined-doc-name, cast-local-type, param-type-mismatch, return-type-mismatch, missing-parameter, discard-returns
--[[
    事件系统 (Event System)
    从 zhanshen 项目移植
    
    功能:
    - 发布-订阅模式的事件总线
    - 支持事件优先级
    - 支持绑定对象和自动解注册
    - 用于模块间解耦通信
    
    使用示例:
    ```lua
    -- 注册事件
    local id = Event:on('怪物击杀', function(killer, victim) 
        print(killer:GetName() .. ' 击杀了 ' .. victim:GetName())
    end)
    
    -- 触发事件
    Event:send('怪物击杀', attacker, target)
    
    -- 解注册
    Event:unregisterByID(id)
    ```
]]

if nil == Event then
	---@class Event
	Event = {
		m_tabEvent = {},
		m_nIncludeID = 0,
	}
	Event = class({}, Event)
end
---@type Event
local public = Event

-- 事件优先级常量
EVENT_LEVEL_NONE = 0
EVENT_LEVEL_LOW = 10000
EVENT_LEVEL_MEDIUM = 20000
EVENT_LEVEL_HIGH = 30000
EVENT_LEVEL_ULTRA = 40000

---注册事件
---@param strEvent string 事件名
---@param funCallBack function|string 回调函数or函数名 @回调返回true立即解注册
---@param oBind table|nil 绑定的对象 @nil则回调时不带对象
---@param nOrder number|nil 优先顺序 @值越大触发回调越优先，默认 EVENT_LEVEL_NONE
---@param bindID number|nil 绑定ID 可选 可以指定以某值做ID
---@return number 注册ID
function public:on(strEvent, funCallBack, oBind, nOrder, bindID)
	if "string" ~= type(strEvent) then
		error("strEvent is not string")
	end
	if "function" ~= type(funCallBack) and "string" ~= type(funCallBack) then
		error("funCallBack is not function or string")
	end
	if not self:_getFun(funCallBack, oBind) then
		error("funCallBack is undefined")
	end
	if nil ~= oBind and "table" ~= type(oBind) then
		if "number" == type(oBind) then
			nOrder = oBind
			oBind = nil
		end
	end
	if "number" ~= type(nOrder) then
		nOrder = EVENT_LEVEL_NONE
	end

	local tab = self.m_tabEvent[strEvent]
	if nil == tab then
		tab = {}
		self.m_tabEvent[strEvent] = tab
	else
		for _, v in ipairs(tab) do
			if v.fun == funCallBack and v.oBind == oBind then
				if v.nOrder ~= nOrder then
					v.nOrder = nOrder
					table.sort(tab, function(a, b)
						return a.nOrder < b.nOrder
					end)
				end
				return v.nID
			end
		end
	end

	local nID
	if bindID then
		nID = bindID
		self:unregisterByID(bindID, strEvent)
	else
		nID = self:_getIncludeID()
	end

	table.insert(tab, {
		fun = funCallBack
		,
		oBind = oBind
		,
		nOrder = nOrder
		,
		nID = nID
	})

	table.sort(tab, function(a, b)
		return a.nOrder < b.nOrder
	end)
	return nID
end

---解注册
---@param strEvent string 事件名
---@param funCallBack function|string 注册的函数
---@param oBind table|nil 绑定的对象
---@return boolean|nil 是否成功解注册
function public:unregister(strEvent, funCallBack, oBind)
	if "string" ~= type(strEvent) then
		error("strEvent is not string")
	end
	if "function" ~= type(funCallBack) and "string" ~= type(funCallBack) then
		error("funCallBack is not function or string")
	end
	funCallBack = self:_getFun(funCallBack, oBind)
	if not funCallBack then
		error("funCallBack is undefined")
	end
	if nil ~= oBind and "table" ~= type(oBind) then
		error("oBind is not table")
	end

	local tab = self.m_tabEvent[strEvent]
	if nil == tab then
		return
	end
	for i, tabInfo in pairs(tab) do
		if funCallBack == self:_getFun(tabInfo.fun, tabInfo.oBind) and oBind == tabInfo.oBind then
			table.remove(tab, i)
			return true
		end
	end
end

---通过ID解注册
---@param nID number 注册ID
---@param strEvent string|nil 事件名 @选填，提供可提升性能
---@return boolean 是否成功解注册
function public:unregisterByID(nID, strEvent)
	if "string" == type(strEvent) then
		if self.m_tabEvent[strEvent] then
			for i, tabInfo in pairs(self.m_tabEvent[strEvent]) do
				if nID == tabInfo.nID then
					table.remove(self.m_tabEvent[strEvent], i)
					return true
				end
			end
		end
	else
		for _, v in pairs(self.m_tabEvent) do
			for i, tabInfo in pairs(v) do
				if nID == tabInfo.nID then
					table.remove(v, i)
					return true
				end
			end
		end
	end
	return false
end

---批量解注册
---@param tID table 注册ID数组
function public:unregisterByIDs(tID)
	if "table" == type(tID) then
		for _, v in pairs(tID) do
			self:unregisterByID(v)
		end
	end
end

---解除所有注册事件
function public:unregisterAll()
    for _, tab in pairs(self.m_tabEvent) do
        for i = #tab, 1, -1 do
            table.remove(tab, i)
        end
    end
    self.m_tabEvent = {}
end

---触发事件
---@param strEvent string 事件名
---@vararg any 附带参数
function public:send(strEvent, ...)
	local tab = self.m_tabEvent[strEvent]
	if nil == tab then
		return
	end
	
	local arrEvents = {}
	for _, v in ipairs(tab) do
		table.insert(arrEvents, v)
	end

	table.sort(arrEvents, function(a, b) return a.nOrder < b.nOrder end)

	for i = #arrEvents, 1, -1 do
		local event = arrEvents[i];
		local bDel
		if nil == event.fun then
			bDel = true
		else
			local fun = self:_getFun(event.fun, event.oBind)
			if fun then
				bDel = self:_call(fun, event.oBind, ...)
			else
				bDel = true
			end
		end
		if bDel then
			self:unregisterByID(event.nID, strEvent)
		end
	end
end

---@private
function public:_getIncludeID()
	self.m_nIncludeID = self.m_nIncludeID + 1
	return self.m_nIncludeID
end

---@private
function public:_getFun(fun, oBind)
	if 'function' ~= type(fun) then
		if nil == oBind then
			fun = _G[fun]
		else
			fun = oBind[fun]
		end
	end
	if 'function' == type(fun) then
		return fun
	end
	return false
end

---@private
function public:_call(fun, oBind, ...)
	local bSuccess, result = xpcall(function(...)
		if oBind then
			return fun(oBind, ...)
		else
			return fun(...)
		end
	end, self._err, ...)
	if not bSuccess then
		return false
	end
	return result
end

---@private
function public._err(...)
	print(debug.traceback(...))
end

-- 挂载到 GameRules 确保全局可用
GameRules.Event = GameRules.Event or Event
