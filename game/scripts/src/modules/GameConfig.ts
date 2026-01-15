import { DEV_HERO } from '../config/DevConfig';

export class GameConfig {
    constructor() {
        SendToServerConsole('dota_max_physical_items_purchase_limit 9999'); // 用来解决物品数量限制问题

        GameRules.SetCustomGameSetupAutoLaunchDelay(0); // 游戏设置时间（默认的游戏设置是最开始的队伍分配）
        GameRules.SetCustomGameSetupRemainingTime(0); // 游戏设置剩余时间
        GameRules.SetCustomGameSetupTimeout(1); // 游戏设置阶段超时 (设置为0秒后无法正常创建英雄)
        GameRules.SetHeroSelectionTime(0); // 选择英雄阶段的持续时间
        GameRules.SetStrategyTime(0); // 策略阶段时间
        GameRules.SetShowcaseTime(0); // 选完英雄的展示时间
        GameRules.SetPreGameTime(0); // 进入游戏后号角吹响前的准备时间
        GameRules.SetPostGameTime(30); // 游戏结束后时长
        GameRules.SetSameHeroSelectionEnabled(true); // 是否允许选择相同英雄
        GameRules.SetStartingGold(0); // 设置初始金钱
        GameRules.SetGoldTickTime(0); // 设置工资发放间隔
        GameRules.SetGoldPerTick(0); // 设置工资发放数额
        GameRules.SetHeroRespawnEnabled(true); // 是否允许英雄重生
        GameRules.SetCustomGameAllowMusicAtGameStart(false); // 是否允许游戏开始时的音乐
        GameRules.SetCustomGameAllowHeroPickMusic(false); // 是否允许英雄选择阶段的音乐
        GameRules.SetCustomGameAllowBattleMusic(false); // 是否允许战斗阶段音乐
        GameRules.SetUseUniversalShopMode(true); // 是否启用全地图商店模式（在基地也可以购买神秘商店的物品）* 这个不是设置在任何地方都可以购买，如果要设置这个，需要将购买区域覆盖全地图
        GameRules.SetHideKillMessageHeaders(true); // 是否隐藏顶部的英雄击杀信息

        const game: CDOTABaseGameMode = GameRules.GetGameModeEntity();
        game.SetRemoveIllusionsOnDeath(true); // 是否在英雄死亡的时候移除幻象
        game.SetSelectionGoldPenaltyEnabled(false); // 是否启用选择英雄时的金钱惩罚（超时每秒扣钱）
        game.SetLoseGoldOnDeath(false); // 是否在英雄死亡时扣除金钱
        game.SetBuybackEnabled(false); // 是否允许买活
        game.SetDaynightCycleDisabled(true); // 是否禁用白天黑夜循环
        game.SetForceRightClickAttackDisabled(true); // 是否禁用右键攻击
        game.SetHudCombatEventsDisabled(true); // 是否禁用战斗事件（左下角的战斗消息）
        
        // 从 DevConfig 读取默认英雄
        game.SetCustomGameForceHero(DEV_HERO);
        print(`[GameConfig] Default hero set to: ${DEV_HERO}`);
        game.SetUseCustomHeroLevels(true); // 是否启用自定义英雄等级
        game.SetCustomHeroMaxLevel(100); // 设置自定义英雄最大等级
        game.SetCustomXPRequiredToReachNextLevel({
            // 设置自定义英雄每个等级所需经验，这里的经验是升级到这一级所需要的*总经验）
            1: 0,
            2: 100,
            3: 300,
            4: 500,
            5: 1000,
            6: 1500,
            7: 2000,
            8: 2700,
            9: 3500,
            10: 5000,
            11: 5800,
            12: 6500,
            13: 7500,
            14: 8500,
            15: 10000,
            16: 11600,
            17: 13000,
            18: 14000,
            19: 15500,
            20: 20000,
            21: 24000,
            22: 27000,
            23: 30000,
            24: 33000,
            25: 35000,
            26: 38000,
            27: 40000,
            28: 43000,
            29: 45000,
            30: 47000,
            31: 65000,
            32: 70000,
            33: 75000,
            34: 80000,
            35: 85000,
            36: 95000,
            37: 100000,
            38: 105000,
            39: 110000,
            40: 120000,
            41: 140000,
            42: 160000,
            43: 180000,
            44: 200000,
            45: 220000,
            46: 240000,
            47: 260000,
            48: 280000,
            49: 300000,
            50: 320000,
            51: 500000,
            52: 1000000,
        });
        game.SetDaynightCycleDisabled(true); // 是否禁用白天黑夜循环
        game.SetDeathOverlayDisabled(true); // 是否禁用死亡遮罩（灰色的遮罩）
        game.SetFogOfWarDisabled(true); // 禁用战争迷雾
        game.SetAnnouncerDisabled(true); // 禁用播音员
        game.SetRandomHeroBonusItemGrantDisabled(true); // 禁用随机英雄获得额外物品
        game.SetCameraDistanceOverride(1700); // 设置镜头距离
        game.SetCameraZRange(0, 5000); // 设置镜头高度范围
        game.SetFixedRespawnTime(999); // 设置固定重生时间

        // Disable vanilla attributes
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.STRENGTH_HP, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.STRENGTH_HP_REGEN, 0.1);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.STRENGTH_DAMAGE, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.AGILITY_DAMAGE, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.INTELLIGENCE_DAMAGE, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.AGILITY_ARMOR, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.AGILITY_ATTACK_SPEED, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.INTELLIGENCE_DAMAGE, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.INTELLIGENCE_MANA, 0);
        game.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.INTELLIGENCE_MANA_REGEN, 0);

        // 设置自定义的队伍人数上限
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.GOODGUYS, 4);
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.BADGUYS, 0); // Disable bad guys for custom single/coop RPG
        // for (let team = DotaTeam.CUSTOM_1; team <= DotaTeam.CUSTOM_8; ++team) {
        //     GameRules.SetCustomGameTeamMaxPlayers(team, 1);
        // }
    }
}
