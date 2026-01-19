/**
 * Player 类 - 封装单个玩家的所有逻辑
 *
 * 通过 SetPlayerSys(id, 'assets', player) 注册
 * 通过 player.GetAsset() 或 GetPlayerSys(id, 'assets') 获取
 *
 * 使用示例:
 *   const player = PlayerResource.GetPlayer(0);
 *   const assets = player.GetAsset();
 *   assets.AddSpiritCoin(100);
 *   assets.OnHeroSpawned();
 */

import { CustomStats } from '../systems/CustomStats';
import { EconomySystem } from '../mechanics/EconomySystem';

export class Player {
    public readonly id: PlayerID;

    constructor(id: PlayerID) {
        this.id = id;
        print(`[Player] 玩家 ${id} 初始化`);
    }

    // ========== 控制器访问 ==========

    /**
     * 获取玩家控制器
     */
    GetController(): CDOTAPlayerController | null {
        return PlayerResource.GetPlayer(this.id);
    }

    /**
     * 获取玩家英雄
     */
    GetHero(): CDOTA_BaseNPC_Hero | null {
        return this.GetController()?.GetAssignedHero() || null;
    }

    /**
     * 获取玩家
     */
    GetPlayer(): CDOTAPlayerController | null {
        return this.GetController();
    }

    // ========== CustomValue 快捷方法 ==========

    /**
     * 设置临时值
     */
    SetCustomValue(key: string, value: any): void {
        this.GetController()?.SetCustomValue(key, value);
    }

    /**
     * 获取临时值
     */
    GetCustomValue(key: string): any {
        return this.GetController()?.GetCustomValue(key) || 0;
    }

    /**
     * 增加临时值
     */
    AddCustomValue(key: string, value: number): void {
        this.GetController()?.AddCustomValue(key, value);
    }

    // ========== 英雄属性 (委托给 CustomStats) ==========

    /**
     * 获取所有自定义属性
     */
    GetAllStats() {
        const hero = this.GetHero();
        if (!hero) return null;
        return CustomStats.GetAllStats(hero);
    }

    // ========== 经济系统 (委托给 EconomySystem) ==========

    /**
     * 获取灵石数量
     */
    GetSpiritCoin(): number {
        return EconomySystem.GetInstance().GetSpiritCoin(this.id);
    }

    /**
     * 增加灵石
     */
    AddSpiritCoin(amount: number): void {
        EconomySystem.GetInstance().AddSpiritCoin(this.id, amount);
    }

    /**
     * 消费灵石
     * @returns 是否成功
     */
    SpendSpiritCoin(amount: number): boolean {
        const current = this.GetSpiritCoin();
        if (current >= amount) {
            EconomySystem.GetInstance().AddSpiritCoin(this.id, -amount);
            return true;
        }
        return false;
    }

    // ========== 英雄管理 ==========

    /**
     * 获取选择的英雄名称
     */
    GetSelectedHero(): string {
        return this.GetCustomValue('_selectedHero') || '';
    }

    /**
     * 设置选择的英雄名称
     */
    SetSelectedHero(heroName: string): void {
        this.SetCustomValue('_selectedHero', heroName);
    }

    /**
     * 创建或替换英雄
     * 参考 zhanshen 项目的实现：先 RemoveSelf，再 ReplaceHeroWith
     * @returns 创建的英雄
     */
    CreateHero(heroName: string): CDOTA_BaseNPC_Hero | null {
        const controller = this.GetController();
        if (!controller) {
            print(`[Player] 玩家 ${this.id} 控制器不存在`);
            return null;
        }

        // 保存选择的英雄
        this.SetSelectedHero(heroName);

        // 检查是否已有英雄
        const existingHero = controller.GetAssignedHero();

        if (existingHero && !existingHero.IsNull()) {
            const currentName = existingHero.GetUnitName();
            if (currentName === heroName) {
                print(`[Player] 英雄已存在: ${heroName}`);
            } else {
                // 已有不同英雄，由于引擎限制无法运行时替换
                print(`[Player] 已有英雄 ${currentName}，由于引擎限制无法替换到 ${heroName}`);
                print(`[Player] 如需更换英雄，请修改 DevConfig.ts 中的 DEV_HERO 设置并重启游戏`);
            }
            return existingHero;
        }

        // 创建新英雄
        print(`[Player] 创建新英雄: ${heroName}`);
        const hero = CreateHeroForPlayer(heroName, controller);
        return hero;
    }

    // ========== 事件处理 ==========

    /**
     * 英雄出生时调用
     */
    OnHeroSpawned(): void {
        print(`[Player] 玩家 ${this.id} 英雄出生`);
        // 可以在这里添加初始化逻辑
    }

    /**
     * 英雄死亡时调用
     */
    OnHeroDeath(): void {
        print(`[Player] 玩家 ${this.id} 英雄死亡`);
        // 可以在这里添加死亡处理逻辑
    }

    /**
     * 回城时调用
     */
    OnReturn(): void {
        print(`[Player] 玩家 ${this.id} 回城`);
        // 可以在这里添加回城逻辑
    }

    /**
     * 重生英雄
     */
    RespawnHero(): void {
        const hero = this.GetHero();
        if (hero && !hero.IsAlive()) {
            hero.RespawnHero(false, false);
        }
    }
}
