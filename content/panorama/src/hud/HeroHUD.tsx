import { type FC, useState, useEffect } from 'react';
import { isAnyPanelOpen as checkPanelOpen } from './PanelManager';

// 职业名称映射
const JOB_NAME_MAP: { [key: string]: string } = {
    "bing_shen_dao": "兵神道",
    // 其他职业映射
};

// 获取本地化文本：支持 #Token 格式 和 映射表
function getLocalizedJobName(value: string | undefined, fallback: string = "..."): string {
    if (!value || value === "undefined") return fallback;
    
    value = value.trim();
    
    // 如果是本地化 token（以 # 开头），使用 $.Localize()
    if (value.startsWith("#")) {
        const localized = $.Localize(value);
        if (localized && localized !== value) {
            return localized;
        }
        // 去掉 # 尝试
        const tokenWithoutHash = value.substring(1);
        if (JOB_NAME_MAP[tokenWithoutHash]) {
            return JOB_NAME_MAP[tokenWithoutHash];
        }
    }
    
    // 尝试从映射表获取
    if (JOB_NAME_MAP[value]) {
        return JOB_NAME_MAP[value];
    }
    
    // 返回原始值（如果是英文ID则返回fallback）
    if (value.startsWith("npc_") || value.includes("_hero_")) {
        return fallback;
    }
    
    return value;
}

// 属性文字样式
const statLabelStyle = {
    fontSize: '16px',
    color: '#c9b896',
    marginLeft: '6px',
    width: '50px',
};

const statValueStyle = {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#ffdd88',
    textShadow: '1px 1px 2px #000000, 0px 0px 4px #ffcc00',
    marginLeft: '4px',
    width: '80px',
};

// 属性数据接口
interface HeroStats {
    attack: number;      // 攻击 (来自 Entities API)
    defense: number;     // 防御 (来自 Entities API)
    constitution: number; // 根骨 (来自 NetTable)
    martial: number;     // 武道 (来自 NetTable)
    divinity: number;    // 神念 (来自 NetTable)
    hp: number;          // 当前生命
    maxHp: number;       // 最大生命
    mp: number;          // 当前灵力
    maxMp: number;       // 最大灵力
}

/**
 * 英雄HUD组件 - 底部信息栏
 * 头像框在背景内部左侧
 */
// 血条状态类型
type HpState = 'normal' | 'healing' | 'damaged' | 'low' | 'full';

const HeroHUD: FC = () => {
    const [professionName, setProfessionName] = useState("...");
    const [stats, setStats] = useState<HeroStats>({
        attack: 0,
        defense: 0,
        constitution: 0,
        martial: 0,
        divinity: 0,
        hp: 0,
        maxHp: 1,
        mp: 0,
        maxMp: 1,
    });
    
    // 血条状态追踪
    const [prevHp, setPrevHp] = useState(0);
    const [hpState, setHpState] = useState<HpState>('normal');
    
    // Buff列表 - 存储当前英雄的buff信息
    interface BuffInfo {
        buffSerial: number;
        textureName: string;
        stackCount: number;
    }
    const [buffs, setBuffs] = useState<BuffInfo[]>([]);
    
    // 隐藏状态 - 当其他面板打开时隐藏HeroHUD
    const [isHidden, setIsHidden] = useState(false);
    
    // 监听面板打开/关闭事件 - 使用 PanelManager 状态检测
    useEffect(() => {
        // 定期检查面板状态
        function checkPanelState() {
            setIsHidden(checkPanelOpen());
            $.Schedule(0.1, checkPanelState);
        }
        checkPanelState();
    }, []);
    
    // 计算血条状态 - 优化：只在状态实际改变时才更新
    useEffect(() => {
        const hpPercent = stats.hp / stats.maxHp;
        
        let newState: HpState = 'normal';
        
        if (stats.hp >= stats.maxHp) {
            newState = 'full';
        } else if (hpPercent <= 0.25) {
            newState = 'low';
        } else if (stats.hp > prevHp && prevHp > 0) {
            newState = 'healing';
            // 回血状态持续1秒后恢复正常
            $.Schedule(1.0, () => {
                setHpState(prev => prev === 'healing' ? 'normal' : prev);
            });
        } else if (stats.hp < prevHp && prevHp > 0) {
            newState = 'damaged';
            // 掉血状态持续0.5秒后恢复正常
            $.Schedule(0.5, () => {
                setHpState(prev => prev === 'damaged' ? 'normal' : prev);
            });
        }
        
        // 只在状态改变时才更新
        if (newState !== hpState && (newState === 'healing' || newState === 'damaged' || newState === 'low' || newState === 'full')) {
            setHpState(newState);
        }
        
        // 只在HP值真正改变时更新 prevHp
        if (stats.hp !== prevHp) {
            setPrevHp(stats.hp);
        }
    }, [stats.hp, stats.maxHp]);

    useEffect(() => {
        // 获取防御、HP、MP (来自 Entities API) - 攻击力由 NetTable 计算
        const updateApiStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const armor = Entities.GetPhysicalArmorValue(localHero);
            
            // 获取真实HP/MP
            const hp = Entities.GetHealth(localHero);
            const maxHp = Entities.GetMaxHealth(localHero);
            const mp = Entities.GetMana(localHero);
            const maxMp = Entities.GetMaxMana(localHero);

            setStats(prev => ({
                ...prev,
                // attack 由 updateNetTableStats 计算，不在这里设置
                defense: Math.floor(armor),
                hp: hp,
                maxHp: maxHp || 1,
                mp: mp,
                maxMp: maxMp || 1,
            }));
        };

        // 获取职业和自定义属性 (来自 NetTable)
        const updateNetTableStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const netTableKey = String(localHero);
            const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, netTableKey);

            if (netTableData) {
                const d = netTableData as any;
                const level = Entities.GetLevel(localHero);
                
                // 职业 - 使用本地化函数获取显示名称
                const professionKey = d.profession;
                setProfessionName(getLocalizedJobName(professionKey, "..."));

                // 根骨、武道、神念 - 使用正确公式计算面板值
                // 公式: (基础 + (等级-1) * 成长 + 额外获得值) * (1 + 加成)
                const conBase = d.constitution_base || 0;
                const conGain = d.constitution_gain || 0;
                const conBonus = d.constitution_bonus || 0;
                const conExtra = d.extra_constitution || 0;
                const constitution = Math.floor((conBase + (level - 1) * conGain + conExtra) * (1 + conBonus));
                
                const marBase = d.martial_base || 0;
                const marGain = d.martial_gain || 0;
                const marBonus = d.martial_bonus || 0;
                const marExtra = d.extra_martial || 0;
                const martial = Math.floor((marBase + (level - 1) * marGain + marExtra) * (1 + marBonus));
                
                const divBase = d.divinity_base || 0;
                const divGain = d.divinity_gain || 0;
                const divBonus = d.divinity_bonus || 0;
                const divExtra = d.extra_divinity || 0;
                const divinity = Math.floor((divBase + (level - 1) * divGain + divExtra) * (1 + divBonus));
                
                // 攻击力计算 = (基础攻击 + 额外攻击) + 主属性*2
                const dmgBase = d.damage_base || 0;
                const dmgGain = d.damage_gain || 0;
                const dmgBonus = d.damage_bonus || 0;
                const dmgExtra = d.extra_base_damage || 0;
                const dmgPanel = Math.floor((dmgBase + (level - 1) * dmgGain + dmgExtra) * (1 + dmgBonus));
                const mainStat = d.main_stat || 'Martial';
                const mainPanel = mainStat === 'Martial' ? martial : divinity;
                const totalAttack = dmgPanel + mainPanel * 2;
                
                // 防御从 Entities API 获取
                const defense = Math.floor(Entities.GetPhysicalArmorValue(localHero) || 0);
                
                setStats(prev => ({
                    ...prev,
                    constitution: constitution,
                    martial: martial,
                    divinity: divinity,
                    attack: totalAttack,
                    defense: defense,
                }));
            }
        };

        // 延迟初始化，确保英雄实体准备好 (增加到1秒)
        $.Schedule(1.0, () => {
            updateApiStats();
            updateNetTableStats();
        });
        
        // 再次延迟刷新 (3秒后确保数据已同步)
        $.Schedule(3.0, () => {
            updateApiStats();
            updateNetTableStats();
        });

        // 监听 NetTable 变化 (事件驱动)
        CustomNetTables.SubscribeNetTableListener('custom_stats' as any, (table, key, data) => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (key === String(localHero)) {
                updateNetTableStats();
            }
        });
        
        // 定期刷新 NetTable 数据 (每2秒，确保数据同步)
        $.Schedule(1.0, function netTableLoop() {
            updateNetTableStats();
            $.Schedule(2.0, netTableLoop);
        });

        // HP/MP 更新（每0.2秒，约5fps，足够流畅且减少卡顿）
        $.Schedule(0.5, function hpLoop() {
            updateApiStats();
            $.Schedule(0.2, hpLoop);
        });
        
        // Buff 更新函数 - 获取英雄当前所有可见的buff
        const updateBuffs = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;
            
            const buffList: { buffSerial: number; textureName: string; stackCount: number }[] = [];
            
            // 使用正确的Buffs API - 直接使用 buffIndex
            // @ts-ignore
            const modifierCount = Entities.GetNumBuffs(localHero);
            
            for (let i = 0; i < modifierCount; i++) {
                // 在 Panorama 中，Buffs API 直接使用 buffIndex (i) 作为第二个参数
                // @ts-ignore
                const isHidden = Buffs.IsHidden(localHero, i);
                // @ts-ignore
                const modifierName = Buffs.GetName(localHero, i);
                // @ts-ignore
                const textureName = Buffs.GetTexture(localHero, i);
                // @ts-ignore
                const stackCount = Buffs.GetStackCount(localHero, i) || 0;
                
                if (isHidden) continue;
                if (!textureName) continue;
                
                buffList.push({
                    buffSerial: i, // 使用 index 作为唯一标识
                    textureName,
                    stackCount,
                });
            }
            
            setBuffs(buffList);
        };
        
        // Buff 更新循环 - 每0.2秒刷新（保证攻速快时也能跟上）
        $.Schedule(0.5, function buffLoop() {
            updateBuffs();
            $.Schedule(0.2, buffLoop);
        });
    }, []);


    // 如果其他面板打开，则隐藏 HeroHUD
    if (isHidden) {
        return null;
    }

    return (
        <Panel style={{
            horizontalAlign: 'center' as const,
            verticalAlign: 'bottom' as const,
            marginBottom: '0px',
            width: '1200px',
            height: '500px',
        }}>
            {/* Buff/Debuff 栏 - 在血条正上方居中位置 */}
            <Panel style={{
                width: '300px',
                height: '48px',
                position: '565px 275px 0px' as const,
            }}>
                {/* 内部容器 - 用于居中显示buff图标 */}
                <Panel style={{
                    width: '100%',
                    height: '100%',
                    flowChildren: 'right' as const,
                    horizontalAlign: 'center' as const,
                }}>
                    {/* 动态渲染Buff图标 */}
                    {buffs.map((buff) => (
                        <Panel 
                            key={buff.buffSerial} 
                            className="BuffIcon"
                            style={{
                                width: '40px',
                                height: '40px',
                                marginLeft: '4px',
                                marginRight: '4px',
                                border: '2px solid #8b7040',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(30, 25, 20, 0.95)',
                                boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.8), inset 0px 0px 8px rgba(180, 140, 60, 0.3)',
                            }}
                        >
                            <Image 
                                src={`s2r://panorama/images/spellicons/${buff.textureName}_png.vtex`}
                                style={{
                                    width: '34px',
                                    height: '34px',
                                    margin: '3px',
                                    borderRadius: '4px',
                                }}
                            />
                            {/* 层数显示 - 右下角 */}
                            {buff.stackCount > 0 && (
                                <Label 
                                    text={String(buff.stackCount)}
                                    style={{
                                        position: '22px 24px 0px' as const,
                                        width: '18px',
                                        height: '16px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: '#ffeeaa',
                                        textShadow: '1px 1px 2px #000000, 0px 0px 4px #ffaa00',
                                        textAlign: 'center',
                                        backgroundColor: 'rgba(40, 30, 20, 0.9)',
                                        borderRadius: '3px',
                                    }}
                                />
                            )}
                        </Panel>
                    ))}
                </Panel>
            </Panel>

            {/* 主HUD背景横条 - 使用加宽版 */}
            <Image 
                src="file://{resources}/images/hud_bar_extended.png"
                style={{
                    width: '1200px',
                    height: '500px',
                    position: '0px 160px 0px' as const,
                }}
            />
            
            {/* 头像框 - 在背景内部左侧 */}
            <Panel style={{
                width: '210px',
                height: '250px',
                position: '60px 295px 0px' as const,
            }}>
                {/* 头像框内部发光粒子特效 - 底层 */}
                <DOTAParticleScenePanel
                    style={{
                        width: '150px',
                        height: '150px',
                        position: '30px 30px 0px' as const,
                        opacity: '0.6',
                    }}
                    // @ts-ignore
                    hittest={false}
                    particleName="particles/units/heroes/hero_wisp/wisp_ambient.vpcf"
                    particleonly={true}
                    startActive={true}
                    cameraOrigin="0 0 150"
                    lookAt="0 0 0"
                    fov={50}
                    squarePixels={true}
                />
                {/* 英雄动态头像 - 使用 DOTAScenePanel 显示 3D 模型 */}
                <DOTAScenePanel
                    // @ts-ignore
                    unit="npc_dota_hero_juggernaut"
                    style={{
                        width: '145px',
                        height: '145px',
                        position: '32px 32px 0px' as const,
                    }}
                />
                {/* 头像框背景图（中层） */}
                <Image 
                    src="file://{resources}/images/hero_portrait_frame_v2.png"
                    style={{
                        width: '210px',
                        height: '210px',
                        position: '0px 0px 0px' as const,
                    }}
                />
                {/* 英雄职业名称（顶层）- 位置上移 */}
                <Label 
                    text={professionName}
                    style={{
                        width: '210px',
                        position: '0px 162px 0px' as const,
                        fontSize: '22px',
                        fontWeight: 'bold' as const,
                        fontFamily: 'SimHei, Microsoft YaHei, sans-serif',
                        color: '#f0d080',
                        textShadow: '0px 0px 4px #ffcc00, 0px 1px 2px #000000',
                        textAlign: 'center' as const,
                        letterSpacing: '2px',
                    }}
                />
            </Panel>

            {/* 属性面板 - 在头像框右边 */}
            <Panel style={{
                width: '200px',
                height: '200px',
                position: '280px 330px 0px' as const,
            }}>
                {/* 透明边框 */}
                <Image 
                    src="file://{resources}/images/stats_frame.png"
                    style={{
                        width: '180px',
                        height: '200px',
                        position: '-30px -10px 0px' as const,
                    }}
                />
                
                {/* 5个属性行 */}
                <Panel style={{
                    flowChildren: 'down' as const,
                    width: '180px',
                    height: '180px',
                    position: '-5px 6px 0px' as const,
                }}>
                    {/* 攻击 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image 
                            src="file://{resources}/images/icon_attack.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="攻击:" style={statLabelStyle} />
                        <Label text={String(stats.attack)} style={statValueStyle} />
                    </Panel>
                    
                    {/* 防御 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image 
                            src="file://{resources}/images/icon_defense.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="防御:" style={statLabelStyle} />
                        <Label text={String(stats.defense)} style={statValueStyle} />
                    </Panel>
                    
                    {/* 根骨 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image 
                            src="file://{resources}/images/icon_constitution.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="根骨:" style={statLabelStyle} />
                        <Label text={String(stats.constitution)} style={statValueStyle} />
                    </Panel>
                    
                    {/* 武道 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image 
                            src="file://{resources}/images/icon_martial.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="武道:" style={statLabelStyle} />
                        <Label text={String(stats.martial)} style={statValueStyle} />
                    </Panel>
                    
                    {/* 神念 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px', height: '30px' }}>
                        <Image 
                            src="file://{resources}/images/icon_spirit.png"
                            style={{ width: '28px', height: '28px', marginTop: '-2px' }}
                        />
                        <Label text="神念:" style={statLabelStyle} />
                        <Label text={String(stats.divinity)} style={statValueStyle} />
                    </Panel>
                </Panel>
            </Panel>

            {/* 流光分隔线 - 在属性面板右边 */}
            <Image 
                src="file://{resources}/images/divider_glow_vertical.png"
                style={{
                    width: '40px',
                    height: '180px',
                    position: '415px 325px 0px' as const,
                }}
            />

            {/* 血条、蓝条和技能区域 */}
            <Panel style={{
                width: '480px',
                height: '220px',
                position: '450px 340px 0px' as const,
                flowChildren: 'down' as const,
            }}>
                {/* 血条 HP */}
                <Panel style={{
                    width: '400px',
                    height: '38px', 
                    marginBottom: '2px',
                }}>
                    {/* 血条背景 - 根据状态切换样式 */}
                    <Panel 
                        className={
                            hpState === 'low' ? 'HpBarBg--low' : 
                            hpState === 'full' ? 'HpBarBg--full' : 
                            'HpBarBg'
                        }
                        style={{
                            width: '400px',
                            height: '38px',
                        }}
                    >
                        {/* 血条填充 */}
                        <Panel 
                            className={`HpBarFill ${hpState === 'damaged' ? 'HpBarFill--damaged' : ''}`}
                            style={{
                                width: `${Math.floor(396 * stats.hp / stats.maxHp)}px`,
                                height: '34px',
                                marginTop: '2px',
                                marginLeft: '2px',
                                overflow: 'clip' as const,
                            }}
                        >
                            {/* 高光层 */}
                            <Panel className="HpBarShine" />
                            {/* 流动粒子特效 */}
                            <DOTAParticleScenePanel
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    opacity: '0.8',
                                }}
                                // @ts-ignore
                                hittest={false}
                                particleName="particles/healthbar_burner2.vpcf"
                                particleonly={true}
                                startActive={true}
                                cameraOrigin="-700 -395 120"
                                lookAt="0 -385 15"
                                fov={60}
                                squarePixels={true}
                            />
                        </Panel>
                    </Panel>
                    {/* HP数值 */}
                    <Label 
                        text={`${Math.floor(stats.hp)} / ${Math.floor(stats.maxHp)}`}
                        style={{
                            align: 'center center',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            color: hpState === 'low' ? '#ff8888' : hpState === 'full' ? '#ffeecc' : '#ffffee',
                            textShadow: '1px 1px 1px #000000, 0px 0px 4px #aa2222',
                            letterSpacing: '1px',
                        }}
                    />
                </Panel>

                {/* 蓝条 MP */}
                <Panel style={{
                    width: '400px',
                    height: '38px',
                    marginBottom: '8px',
                }}>
                    {/* 蓝条背景 */}
                    <Panel 
                        className="MpBarBg"
                        style={{
                            width: '400px',
                            height: '38px',
                        }}
                    >
                        {/* 蓝条填充 - 渐变 + 动态宽度 */}
                        <Panel 
                            className="MpBarFill"
                            style={{
                                width: `${Math.floor(396 * stats.mp / stats.maxMp)}px`,
                                height: '34px',
                                marginTop: '2px',
                                marginLeft: '2px',
                                overflow: 'clip' as const,
                            }}
                        >
                            {/* 高光层 */}
                            <Panel className="MpBarShine" />
                            {/* 流动粒子特效 */}
                            <DOTAParticleScenePanel
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    opacity: '0.7',
                                }}
                                // @ts-ignore
                                hittest={false}
                                particleName="particles/healthbar_burner2.vpcf"
                                particleonly={true}
                                startActive={true}
                                cameraOrigin="-700 -395 120"
                                lookAt="0 -385 15"
                                fov={60}
                                squarePixels={true}
                            />
                        </Panel>
                    </Panel>
                    {/* 灵力数值 - 金色 */}
                    <Label 
                        text={`${Math.floor(stats.mp)} / ${Math.floor(stats.maxMp)}`}
                        style={{
                            align: 'center center',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            color: '#fff8e0',
                            textShadow: '1px 1px 1px #000000, 0px 0px 4px #aa8822',
                            letterSpacing: '1px',
                        }}
                    />
                </Panel>

                {/* 技能栏 - 4个 + 空隙 + 2个 */}
                <Panel style={{ flowChildren: 'right' as const }}>
                    {/* 第1个技能 - 兵伐·裂空 (使用DOTAAbilityImage显示带Tooltip) */}
                    <Panel className="SkillSlot">
                        <Panel className="SkillSlotFrame">
                            <DOTAAbilityImage 
                                className="SkillSlotInner"
                                // @ts-ignore
                                abilityname="soldier_war_strike"
                                showtooltip={true}
                                style={{
                                    width: '44px',
                                    height: '44px',
                                    margin: '2px',
                                    borderRadius: '2px',
                                }}
                            />
                        </Panel>
                    </Panel>
                    
                    {/* 后3个技能槽 - 空槽 */}
                    {[2, 3, 4].map((skillNum) => (
                        <Panel key={skillNum} className="SkillSlot">
                            <Panel className="SkillSlotFrame">
                                <Panel className="SkillSlotInner" />
                            </Panel>
                        </Panel>
                    ))}
                    
                    {/* 空隙 - 加大间距 */}
                    <Panel style={{ width: '53px', height: '54px' }} />
                    
                    {/* 后2个技能 */}
                    {[5, 6].map((skillNum) => (
                        <Panel key={skillNum} className="SkillSlot">
                            <Panel className="SkillSlotFrame">
                                <Panel className="SkillSlotInner" />
                            </Panel>
                        </Panel>
                    ))}
                </Panel>
            </Panel>

            {/* 装备栏区域 - 右侧 */}
            <Panel style={{
                width: '200px',
                height: '150px',
                position: '884px 345px 0px' as const,
            }}>
                {/* 装备栏 - 6个槽位 (2行3列) */}
                <Panel style={{
                    flowChildren: 'down' as const,
                    width: '220px',
                    height: '140px',
                }}>
                    {/* 第一行 - 3个装备槽 */}
                    <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px' }}>
                        {/* 武器槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            marginRight: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="武器" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                        {/* 衣服槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            marginRight: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="衣服" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                        {/* 饰品槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="饰品" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                    </Panel>
                    
                    {/* 第二行 - 3个装备槽 */}
                    <Panel style={{ flowChildren: 'right' as const }}>
                        {/* 鞋子槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            marginRight: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="鞋子" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                        {/* 法宝槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            marginRight: '6px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="法宝" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                        {/* 秘籍槽 */}
                        <Panel style={{
                            width: '60px',
                            height: '60px',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            border: '2px solid #a08050',
                            borderRadius: '4px',
                        }}>
                            <Label text="秘籍" style={{
                                align: 'center center',
                                fontSize: '12px',
                                color: '#b0a090',
                            }} />
                        </Panel>
                    </Panel>
                </Panel>
            </Panel>
        </Panel>
    );
};

export default HeroHUD;
