/**
 * PlayerRegister - 玩家注册接口
 * 参考 zhanshen 的 PlayerRegister 实现
 *
 * 职责:
 * - 监听玩家连接/断开事件
 * - 创建和管理 Player 实例
 * - 分发英雄出生/死亡事件到对应的 Player 实例
 */

import { Player } from './Player';

export class PlayerRegister {
    private static instance: PlayerRegister;

    /** 回城是否启用 */
    static ReturnEnable: boolean = true;
    /** 复活是否启用 */
    static ResurgenceEnable: boolean = true;

    private constructor() { }

    static GetInstance(): PlayerRegister {
        if (!this.instance) {
            this.instance = new PlayerRegister();
        }
        return this.instance;
    }

    /**
     * 初始化 - 注册事件监听
     */
    Init(): void {
        // 监听玩家完全连接
        ListenToGameEvent('player_connect_full', events => this.OnPlayerConnect(events), this);

        // 监听玩家断开
        ListenToGameEvent('player_disconnect', events => this.OnPlayerDisconnect(events), this);

        // 监听英雄出生
        ListenToGameEvent('npc_spawned', events => this.OnSpawned(events), this);

        // 监听英雄死亡
        ListenToGameEvent('entity_killed', events => this.OnKill(events), this);
    }

    /**
     * 玩家连接时初始化
     */
    OnPlayerConnect(event: PlayerConnectFullEvent): void {
        const playerId = event.PlayerID;
        const controller = PlayerResource.GetPlayer(playerId);

        if (!controller) {
            return;
        }

        // 检查是否已有 Player 实例 (掉线重连的情况)
        const existingAssets = GetPlayerSys(playerId, 'assets');

        if (existingAssets) {
            // 重连 - 数据已存在
            const heroName = existingAssets.GetCustomValue('_selectedHero');
            if (heroName && !controller.GetAssignedHero()) {
                // 英雄创建由 InvitationModule 处理
            }
        } else {
            // 新玩家 - 创建新的 Player 实例
            const assets = new Player(playerId);
            SetPlayerSys(playerId, 'assets', assets);
        }
    }

    /**
     * 玩家断开连接
     * 注意: 不删除数据，保留以便重连恢复
     */
    OnPlayerDisconnect(event: PlayerDisconnectEvent): void {
        // 不删除 PlayerSys 和 PlayerCustomValue 中的数据
    }

    /**
     * 英雄出生事件分发
     */
    OnSpawned(events: NpcSpawnedEvent): void {
        const unit = EntIndexToHScript(events.entindex) as CDOTA_BaseNPC;
        if (!unit || !unit.IsRealHero()) return;

        const controller = unit.GetPlayerOwner();
        if (!controller) return;

        const playerId = controller.GetPlayerID();
        const assets = GetPlayerSys(playerId, 'assets') as Player;

        if (assets) {
            assets.OnHeroSpawned();
        }
    }

    /**
     * 英雄死亡事件分发
     */
    OnKill(events: EntityKilledEvent): void {
        const unit = EntIndexToHScript(events.entindex_killed) as CDOTA_BaseNPC;
        if (!unit || !unit.IsHero()) return;

        // 只处理友方英雄
        if (unit.GetTeamNumber() !== DotaTeam.GOODGUYS) return;

        const controller = unit.GetPlayerOwner();
        if (!controller) return;

        const playerId = controller.GetPlayerID();
        const assets = GetPlayerSys(playerId, 'assets') as Player;

        if (assets) {
            assets.OnHeroDeath();
        }
    }

    /**
     * 获取 Player 实例
     */
    GetPlayer(playerId: PlayerID): Player | null {
        return GetPlayerSys(playerId, 'assets');
    }

    /**
     * 获取所有 Player 实例
     */
    GetAllPlayers(): Player[] {
        const players: Player[] = [];
        for (let i = 0; i < PlayerResource.GetPlayerCount(); i++) {
            const assets = GetPlayerSys(i as PlayerID, 'assets');
            if (assets) {
                players.push(assets);
            }
        }
        return players;
    }
}

// 导出单例获取函数
export function GetPlayerRegister(): PlayerRegister {
    return PlayerRegister.GetInstance();
}
