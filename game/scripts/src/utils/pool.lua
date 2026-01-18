--[[
    权重池系统 (Pool)
    从 zhanshen 项目移植
    用于实现权重随机抽取功能
    
    使用示例:
    ```lua
    local pool1 = pool('装备池')
    pool1:add('普通装备', 70)  -- 70权重
    pool1:add('稀有装备', 25)  -- 25权重
    pool1:add('传说装备', 5)   -- 5权重
    
    local item = pool1:random()  -- 按权重随机抽取
    local item2 = pool1:randomAndRemove()  -- 抽取后移除
    ```
]]

local typeName = 'pool'

--- 从表格中删除指定值
--- @param array table  表格
--- @param value any  要删除的值
--- @param removeAll boolean  是否删除所有相同的值
--- @return integer 删除的值的个数
function table.removeByValue(array, value, removeAll)
    local c, i, max = 0, 1, #array
    while i <= max do
        if array[i] == value then
            table.remove(array, i)
            c = c + 1
            i = i - 1
            max = max - 1
            if not removeAll then break end
        end
        i = i + 1
    end
    return c
end

-- 将奖品置换成权重奖品
local prizeChange = function(self, object, proportion)
    return {
        object = object;
        proportion = proportion;
        virtualProportion = proportion * self.gain
    }
end

--- 添加总权重
local addTotalProportion = function(self, proportion)
    self.totalProportion = self.totalProportion + proportion
    self.virtualTotalProportion = math.modf(self.totalProportion * self.gain)
end

local mt = {
    --- 往奖池添加奖品
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    ---@param proportion number 权重值
    add = function(self, object, proportion)
        if self.mappingTable[object] then
            local pro=self:get(object)
            self:remove(object)
            return self:add(object,pro+proportion)
        end
        if self.upperLimit and self.len >= self.upperLimit then
            print('addingPrizes - 添加失败,当前权重池已满!', object)
            return
        end
        proportion = proportion or 1
        addTotalProportion(self, proportion)
        local weightPrize = prizeChange(self, object, proportion)
        self.mappingTable[object] = weightPrize
        table.insert(self.data, weightPrize)
        self.len = self.len + 1
        return self
    end;

    --- 降低奖品权重
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    ---@param proportion number 要降低的权重值
    sub = function(self, object, proportion)
        if self.mappingTable[object] then
            local pro=self:get(object)
            self:remove(object)
            return self:add(object,pro-proportion)
        else
            print('没有这个奖品,降低权重失败!', object)
            return
        end
    end;

    --- 将奖品移除出奖池
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    remove = function(self, object)
        if not self.mappingTable[object] then
            print('removePrizes - 移除失败,不存在的索引!', object)
            return
        end
        self.mappingTable[object] = nil
        for _, value in ipairs(self.data) do
            if value.object == object then
                table.removeByValue(self.data, value)
                addTotalProportion(self, -value.proportion)
                self.len = self.len - 1
                break
            end
        end
        return self
    end;

    --- 获取奖品得奖概率
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    ---@return number, number 概率百分比, 权重值
    getProbability = function(self, object)
        local weightPrize = self.mappingTable[object]
        return weightPrize.proportion / self.totalProportion, weightPrize.proportion
    end;

    --- 获取奖品权重
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    ---@return number 权重值
    get = function(self, object)
        local weightPrize = self.mappingTable[object]
        return weightPrize and weightPrize.proportion or 0
    end;

    --- 获取奖品权重 (别名)
    getWeightPrize = function(self, object)
        local weightPrize = self.mappingTable[object]
        return weightPrize and weightPrize.proportion or 0
    end;

    --- 修改奖品权重
    ---@param self table 奖池对象
    ---@param object any 奖品对象
    ---@param proportion number 新权重值
    ---@return number, number 旧权重, 新权重
    setWeightPrize = function(self, object, proportion)
        local weightPrize = self.mappingTable[object]
        if not weightPrize then
            return
        end
        local used = weightPrize.proportion
        self.totalProportion = self.totalProportion - used
        weightPrize.proportion = proportion or used
        weightPrize.virtualProportion = weightPrize.proportion * self.gain
        self.totalProportion = self.totalProportion + weightPrize.proportion
        self.virtualTotalProportion = math.modf(self.totalProportion * self.gain)
        return used, weightPrize.proportion
    end;

    --- 随机抽取 (不移除)
    ---@param self table 奖池对象
    ---@return any 抽取的奖品对象，空池返回nil
    random = function(self)
        if self.len == 0 then
            return nil
        end
        local winningProbability = self._random_(self.virtualTotalProportion)
        for _, value in ipairs(self.data) do
            winningProbability = winningProbability - value.virtualProportion
            if winningProbability <= 0 then
                return value.object
            end
        end
    end;

    --- 随机抽取并移除
    ---@param self table 奖池对象
    ---@return any 抽取的奖品对象，空池返回nil
    randomAndRemove = function(self)
        if self.len == 0 then
            return nil
        end
        local winningProbability = self._random_(self.virtualTotalProportion)
        for _, value in ipairs(self.data) do
            winningProbability = winningProbability - value.virtualProportion
            if winningProbability <= 0 then
                table.removeByValue(self.data, value,false)
                addTotalProportion(self, -value.proportion)
                self.mappingTable[value.object] = nil
                self.len = self.len - 1
                return value.object
            end
        end
    end;

    --- 清空奖池
    ---@param self table 奖池对象
    clear = function(self)
        self.len = 0
        self.data = {}
        self.mappingTable = {}
        self.totalProportion = 0
        self.virtualTotalProportion = 0
        return self
    end;

    --- 随机抽取n个不重复的对象
    ---@param self table 奖池对象
    ---@param n number 抽取数量
    ---@return table 抽取结果数组
    randomSole = function (self, n)
        local t = {}
        local t2 = {}
        for i = 1, n do
            local obj = self:random()
            if obj then
                table.insert(t, obj)
                t2[i] = {obj, self:getWeightPrize(obj)}
                self:setWeightPrize(obj, 0)
            end
        end
        for i = 1, n do
            if t2[i] and t2[i] then
                self:add(t2[i][1], t2[i][2])
            end
        end
        return t
    end;

    --- 抽卡随机 (取出n张卡牌，每张卡权重-1)
    ---@param self table 奖池对象
    ---@param n number 抽取数量
    ---@return table 抽取结果数组
    randomCard = function (self, n)
        local t = {}
        local t2 = {}
        for i = 1, n do
            local obj = self:random()
            if obj then
                table.insert(t, obj)
                local w = self:getWeightPrize(obj)
                t2[i] = {obj, 1}
                self:setWeightPrize(obj, w - 1)
            end
        end
        for i = 1, n do
            if t2[i] and t2[i] then
                self:add(t2[i][1], 1)
            end
        end
        return t
    end
}

local meta = {
    __index = mt;
    __tostring = function(self)
        return ('{%s | 名称(%s) 奖品数量(%d) 总比重(%s)}'):format(typeName, self.name, self.len, self.totalProportion)
    end;
    --- 获取奖池内奖品数量
    __len = function(self)
        return self.len
    end;
    --- 遍历奖池内所有奖品
    __pairs = function(self)
        return ipairs(self.data)
    end;
}
setmetatable(meta, meta)

local virtual = 10000

--- @class prizePool
pool = {
    --- 创建一个新的奖池
    ---@param _ any 占位
    ---@param name string 奖池名字
    ---@param upperLimit number|nil 上限
    ---@param gain number|nil 随机范围倍率增益
    ---@return prizePool
    __call = function(_, name, upperLimit, gain)
        ---@type prizePool
        local object = {
            type = typeName;
            len = 0;
            name = name or '未命名奖池';
            upperLimit = upperLimit;
            totalProportion = 0;
            virtualTotalProportion = 0;
            gain = gain or virtual;
            data = {};
            mappingTable = {};
        }
        object._random_ = math.random
        setmetatable(object, meta)
        return object
    end;
    method = mt;
    meta   = meta;
}
setmetatable(pool, pool)
