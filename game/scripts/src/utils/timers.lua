TIMERS_VERSION = "1.06"

--[[
	二叉堆优化的高性能计时器系统
	从 zhanshen 项目移植
]]

-- Binary Heap implementation
BinaryHeap = BinaryHeap or {}
BinaryHeap.__index = BinaryHeap

function BinaryHeap:Insert(item)
	local index = #self + 1
	local key = self.key
	item.index = index
	self[index] = item
	while index > 1 do
		local parent = math.floor(index / 2)
		if self[parent][key] <= item[key] then
			break
		end
		self[index], self[parent] = self[parent], self[index]
		self[index].index = index
		self[parent].index = parent
		index = parent
	end
	return item
end

function BinaryHeap:Remove(item)
	local index = item.index
	if self[index] ~= item then return end
	local key = self.key
	local heap_size = #self
	if index == heap_size then
		self[heap_size] = nil
		return
	end
	self[index] = self[heap_size]
	self[index].index = index
	self[heap_size] = nil
	while true do
		local left = index * 2
		local right = left + 1
		if not self[left] then break end
		local newindex = right
		if self[index][key] >= self[left][key] then
			if not self[right] or self[left][key] < self[right][key] then
				newindex = left
			end
		elseif not self[right] or self[index][key] <= self[right][key] then
			break
		end
		self[index], self[newindex] = self[newindex], self[index]
		self[index].index = index
		self[newindex].index = newindex
		index = newindex
	end
end

setmetatable(BinaryHeap, { __call = function(self, key) return setmetatable({ key = key }, self) end })

function table.merge(input1, input2)
	for i, v in pairs(input2) do
		input1[i] = v
	end
	return input1
end

TIMERS_THINK = 0.01

if _G.Timers == nil then
	print('[Timers] creating Timers')
	_G.Timers = {}
	setmetatable(Timers, {
		__call = function(t, ...)
			return t:CreateTimer(...)
		end
	})
end

function Timers:start()
	self.started = true
	Timers = self
	self:InitializeTimers()
	self.nextTickCallbacks = {}

	local ent = SpawnEntityFromTableSynchronous("info_target", { targetname = "timers_lua_thinker" })
	ent:SetThink("Think", self, "timers", TIMERS_THINK)
end

function Timers:Think()
	local nextTickCallbacks = table.merge({}, Timers.nextTickCallbacks)
	Timers.nextTickCallbacks = {}
	for _, cb in ipairs(nextTickCallbacks) do
		local status, result = xpcall(cb, debug.traceback)
		if not status then
			Timers:HandleEventError(result)
		end
	end

	if GameRules:State_Get() > DOTA_GAMERULES_STATE_POST_GAME then
		return
	end

	-- Process timers
	self:ExecuteTimers(self.realTimeHeap, Time())
	self:ExecuteTimers(self.gameTimeHeap, GameRules:GetGameTime())

	return TIMERS_THINK
end

function Timers:ExecuteTimers(timerList, now)
	if not timerList[1] then return end

	local currentTimer = timerList[1]
	currentTimer.endTime = currentTimer.endTime or now
	
	if now >= currentTimer.endTime then
		timerList:Remove(currentTimer)
		Timers.runningTimer = k
		Timers.removeSelf = false

		local status, timerResult
		if currentTimer.context then
			status, timerResult = xpcall(function() return currentTimer.callback(currentTimer.context, currentTimer) end,
				debug.traceback)
		else
			status, timerResult = xpcall(function() return currentTimer.callback(currentTimer) end, debug.traceback)
		end

		Timers.runningTimer = nil

		if status then
			if timerResult and not Timers.removeSelf then
				currentTimer.endTime = currentTimer.endTime + timerResult
				timerList:Insert(currentTimer)
			end
		else
			Timers:HandleEventError(timerResult)
		end
		self:ExecuteTimers(timerList, now)
	end
end

function Timers:HandleEventError(err)
	if IsInToolsMode() then
		print(err)
	else
		if StatsClient then
			StatsClient:HandleError(err)
		end
	end
end

function Timers:CreateTimer(arg1, arg2, context)
	local timer
	if type(arg1) == "function" then
		if arg2 ~= nil then
			context = arg2
		end
		timer = { callback = arg1 }
	elseif type(arg1) == "table" then
		timer = arg1
	elseif type(arg1) == "number" then
		timer = { endTime = arg1, callback = arg2 }
	end
	if not timer.callback then
		print("Invalid timer created")
		return
	end

	local now = GameRules:GetGameTime()
	local timerHeap = self.gameTimeHeap
	if timer.useGameTime ~= nil and timer.useGameTime == false then
		now = Time()
		timerHeap = self.realTimeHeap
	end

	if timer.endTime == nil then
		timer.endTime = now
	else
		timer.endTime = now + timer.endTime
	end

	timer.context = context

	timerHeap:Insert(timer)

	return timer
end

function Timers:NextTick(callback)
	table.insert(Timers.nextTickCallbacks, callback)
end

function Timers:RemoveTimer(name)
	local timerHeap = self.gameTimeHeap
	if name.useGameTime ~= nil and name.useGameTime == false then
		timerHeap = self.realTimeHeap
	end

	timerHeap:Remove(name)
	if Timers.runningTimer == name then
		Timers.removeSelf = true
	end
end

function Timers:InitializeTimers()
	self.realTimeHeap = BinaryHeap("endTime")
	self.gameTimeHeap = BinaryHeap("endTime")
end

function Timers:GetAllTimers()
	local allTimers = {}
	for _, timer in ipairs(self.realTimeHeap) do
		table.insert(allTimers, timer)
	end
	for _, timer in ipairs(self.gameTimeHeap) do
		table.insert(allTimers, timer)
	end
	return allTimers
end

if not Timers.started then Timers:start() end

GameRules.Timers = GameRules.Timers or Timers
