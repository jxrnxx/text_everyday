/**
 * CDOTAPlayerController 扩展
 * 参考 zhanshen 实现
 * 
 * 提供:
 * - SetCustomValue/GetCustomValue/AddCustomValue: 临时键值对
 * - SyncCustomValue: 同步到 NetTable 给客户端
 * - ClearCustomValue: 清空临时值 (保留 _ 开头的持久值)
 * - GetAsset: 获取 Player 实例
 */

declare global {
    interface CDOTAPlayerController {
        /** 设置临时值 */
        SetCustomValue: (key: string, value: any) => void;
        /** 增加临时值 */
        AddCustomValue: (key: string, value: number) => void;
        /** 获取临时值 */
        GetCustomValue: (key: string) => any;
        /** 同步到 NetTable */
        SyncCustomValue: () => void;
        /** 清空临时值 (保留 _ 开头的持久值) */
        ClearCustomValue: () => void;
        /** 获取 Player 实例 */
        GetAsset: () => any;  // 返回 Player 实例，使用 any 避免循环依赖
    }
}

/**
 * 设置临时值
 */
CDOTAPlayerController.SetCustomValue = function (key: string, value: any) {
    const id = this.GetPlayerID();
    if (!_G['PlayerCustomValue'][id]) _G['PlayerCustomValue'][id] = {};
    _G['PlayerCustomValue'][id][key] = value;
    this.SyncCustomValue();
};

/**
 * 获取临时值
 */
CDOTAPlayerController.GetCustomValue = function (key: string) {
    const id = this.GetPlayerID();
    if (!_G['PlayerCustomValue'][id]) return 0;
    return _G['PlayerCustomValue'][id][key] || 0;
};

/**
 * 增加临时值
 */
CDOTAPlayerController.AddCustomValue = function (key: string, value: number) {
    this.SetCustomValue(key, this.GetCustomValue(key) + value);
};

/**
 * 同步到 NetTable (客户端可读)
 */
CDOTAPlayerController.SyncCustomValue = function () {
    const id = this.GetPlayerID();
    if (!_G['PlayerCustomValue'][id]) return;
    // 使用 any 绕过类型检查，CustomValue 是动态添加的 NetTable
    CustomNetTables.SetTableValue('CustomValue' as any, 'player' + id.toString(), _G['PlayerCustomValue'][id]);
};

/**
 * 清空临时值
 * 注意: _ 开头的键会被保留 (持久数据)
 */
CDOTAPlayerController.ClearCustomValue = function () {
    const id = this.GetPlayerID();
    const preserved: Record<string, any> = {};

    if (_G['PlayerCustomValue'][id]) {
        for (const k in _G['PlayerCustomValue'][id]) {
            if (k[0] === '_') {
                preserved[k] = _G['PlayerCustomValue'][id][k];
            }
        }
    }

    _G['PlayerCustomValue'][id] = preserved;
    this.SyncCustomValue();
};

/**
 * 获取 Player 实例
 * 通过 GetPlayerSys 从全局存储获取
 */
CDOTAPlayerController.GetAsset = function () {
    return GetPlayerSys(this.GetPlayerID(), 'assets');
};

export { };
