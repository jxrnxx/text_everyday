import { type FC, useState, useEffect } from 'react';

/**
 * 敌人信息接口
 */
interface EnemyInfo {
    entityIndex: EntityIndex;
    name: string;           // 敌人名称
    profession: string;     // 职业
    rank: string;           // 阶位
    attack: number;         // 攻击
    defense: number;        // 防御
    hp: number;             // 当前血量
    maxHp: number;          // 最大血量
}

/**
 * 阶位映射 (StatLabel 0-5 -> 中文显示)
 */
const RANK_NAME_MAP: { [key: number]: string } = {
    0: "凡胎",
    1: "觉醒",
    2: "宗师",
    3: "半神",
    4: "神话",
    5: "禁忌",
};

/**
 * 敌人面板组件 - 显示当前选中敌人的信息
 * 包含：统一头像、名称、职业、阶位、攻击、防御、血条
 */
const EnemyPanel: FC = () => {
    const [enemy, setEnemy] = useState<EnemyInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 定期检查选中的敌人
        const updateSelectedEnemy = () => {
            const localPlayer = Players.GetLocalPlayer();
            
            // 使用 Players.GetQueryUnit 获取当前查询的单位（点击选中的单位）
            // @ts-ignore
            const queryUnit = Players.GetQueryUnit(localPlayer);
            
            // 如果没有选中单位，尝试获取 LocalPlayerPortraitUnit
            // @ts-ignore
            const selectedUnit = queryUnit !== -1 ? queryUnit : Players.GetLocalPlayerPortraitUnit();
            
            if (selectedUnit && selectedUnit !== -1) {
                const localHero = Players.GetPlayerHeroEntityIndex(localPlayer);
                
                // 检查是否为有效的敌对单位
                // @ts-ignore
                const isEnemy = Entities.IsEnemy(selectedUnit);
                // @ts-ignore
                const isAlive = Entities.IsAlive(selectedUnit);
                
                // 只显示敌对单位的面板 (不是自己的英雄，且是敌对单位)
                if (selectedUnit !== localHero && isEnemy && isAlive) {
                    // 获取单位信息
                    // @ts-ignore
                    const unitName = Entities.GetUnitName(selectedUnit);
                    const displayName = $.Localize(`#UnitNameCn_${unitName}`) || unitName || "未知敌人";
                    
                    // 从 CustomNetTables 获取单位的 KV 数据 (包括 StatLabel)
                    // 单位的 KV 数据通常需要从服务器同步，这里使用 entity_kv 表
                    const kvData = CustomNetTables.GetTableValue('entity_kv' as any, String(selectedUnit));
                    const kv = kvData as any || {};
                    
                    // 获取 StatLabel (阶位等级 0-5)
                    const statLabel = kv.StatLabel !== undefined ? kv.StatLabel : 0;
                    const rankName = RANK_NAME_MAP[statLabel] || "凡胎";
                    
                    // 获取攻击力和防御
                    // @ts-ignore
                    const damageMin = Entities.GetDamageMin(selectedUnit) || 0;
                    // @ts-ignore
                    const damageMax = Entities.GetDamageMax(selectedUnit) || 0;
                    const attack = Math.floor((damageMin + damageMax) / 2);
                    // @ts-ignore
                    const defense = Math.floor(Entities.GetPhysicalArmorValue(selectedUnit) || 0);
                    
                    // 获取血量
                    // @ts-ignore
                    const hp = Entities.GetHealth(selectedUnit);
                    // @ts-ignore
                    const maxHp = Entities.GetMaxHealth(selectedUnit) || 1;

                    const enemyInfo: EnemyInfo = {
                        entityIndex: selectedUnit,
                        name: displayName,
                        profession: kv.Profession || "妖兽",
                        rank: rankName,
                        attack: attack,
                        defense: defense,
                        hp: hp,
                        maxHp: maxHp,
                    };
                    
                    setEnemy(enemyInfo);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                    setEnemy(null);
                }
            } else {
                setIsVisible(false);
                setEnemy(null);
            }
            
            $.Schedule(0.1, updateSelectedEnemy);
        };
        
        updateSelectedEnemy();
    }, []);

    // 如果没有选中敌人，则隐藏面板
    if (!isVisible || !enemy) {
        return null;
    }

    // 血量百分比
    const hpPercent = Math.floor((enemy.hp / enemy.maxHp) * 100);
    const hpBarWidth = Math.floor(180 * enemy.hp / enemy.maxHp);

    return (
        <Panel style={{
            position: '50px 200px 0px' as const,
            width: '280px',
            height: '120px',
            flowChildren: 'right' as const,
            backgroundColor: 'rgba(15, 10, 8, 0.92)',
            border: '2px solid #8b6930',
            borderRadius: '8px',
            boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.9), inset 0px 0px 20px rgba(139, 105, 48, 0.15)',
        }}>
            {/* 左侧 - 统一头像 */}
            <Panel style={{
                width: '80px',
                height: '100%',
                margin: '10px',
            }}>
                <Image 
                    src="file://{resources}/images/enemy_portrait_generic.png"
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        border: '2px solid #6b4420',
                        boxShadow: '0px 0px 8px rgba(180, 50, 50, 0.5)',
                    }}
                />
            </Panel>

            {/* 右侧 - 信息区域 */}
            <Panel style={{
                width: '175px',
                height: '100%',
                flowChildren: 'down' as const,
                marginTop: '8px',
            }}>
                {/* 第一行：名称 */}
                <Label 
                    text={enemy.name}
                    style={{
                        fontSize: '18px',
                        fontWeight: 'bold' as const,
                        color: '#ffddaa',
                        textShadow: '1px 1px 2px #000000, 0px 0px 4px #aa4400',
                        marginBottom: '2px',
                    }}
                />
                
                {/* 第二行：职业 + 阶位 */}
                <Panel style={{ flowChildren: 'right' as const, marginBottom: '4px' }}>
                    <Label 
                        text={enemy.profession}
                        style={{
                            fontSize: '13px',
                            color: '#c9a860',
                            marginRight: '10px',
                        }}
                    />
                    <Label 
                        text={enemy.rank}
                        style={{
                            fontSize: '13px',
                            color: '#88ccaa',
                            textShadow: '0px 0px 4px #44aa66',
                        }}
                    />
                </Panel>

                {/* 第三行：攻击 + 防御 */}
                <Panel style={{ flowChildren: 'right' as const, marginBottom: '6px' }}>
                    {/* 攻击 */}
                    <Panel style={{ flowChildren: 'right' as const, marginRight: '15px' }}>
                        <Label 
                            text="攻:"
                            style={{
                                fontSize: '12px',
                                color: '#b0a080',
                                marginRight: '4px',
                            }}
                        />
                        <Label 
                            text={String(enemy.attack)}
                            style={{
                                fontSize: '13px',
                                fontWeight: 'bold' as const,
                                color: '#ff8866',
                                textShadow: '0px 0px 3px #aa4422',
                            }}
                        />
                    </Panel>
                    {/* 防御 */}
                    <Panel style={{ flowChildren: 'right' as const }}>
                        <Label 
                            text="防:"
                            style={{
                                fontSize: '12px',
                                color: '#b0a080',
                                marginRight: '4px',
                            }}
                        />
                        <Label 
                            text={String(enemy.defense)}
                            style={{
                                fontSize: '13px',
                                fontWeight: 'bold' as const,
                                color: '#66aaff',
                                textShadow: '0px 0px 3px #2266aa',
                            }}
                        />
                    </Panel>
                </Panel>

                {/* 第四行：血条 */}
                <Panel style={{
                    width: '180px',
                    height: '16px',
                }}>
                    {/* 血条背景 */}
                    <Panel style={{
                        width: '180px',
                        height: '16px',
                        backgroundColor: 'rgba(30, 15, 10, 0.95)',
                        border: '1px solid #6b4420',
                        borderRadius: '3px',
                        boxShadow: 'inset 0px 1px 4px rgba(0, 0, 0, 0.6)',
                    }}>
                        {/* 血条填充 */}
                        <Panel style={{
                            width: `${hpBarWidth}px`,
                            height: '12px',
                            marginTop: '1px',
                            marginLeft: '1px',
                            backgroundColor: hpPercent <= 25 
                                ? 'gradient(linear, 0% 0%, 0% 100%, from(#ff4444), to(#aa2222))'
                                : 'gradient(linear, 0% 0%, 0% 100%, from(#cc3333), color-stop(0.5, #aa2222), to(#881111))',
                            borderRadius: '2px',
                            boxShadow: hpPercent <= 25
                                ? 'inset 0px 1px 0px rgba(255, 150, 150, 0.4), 0px 0px 4px rgba(255, 50, 50, 0.5)'
                                : 'inset 0px 1px 0px rgba(255, 150, 150, 0.3)',
                            overflow: 'clip' as const,
                        }}>
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
                    {/* 血量文字 */}
                    <Label 
                        text={`${Math.floor(enemy.hp)} / ${Math.floor(enemy.maxHp)}`}
                        style={{
                            align: 'center center',
                            fontSize: '11px',
                            fontWeight: 'bold' as const,
                            color: hpPercent <= 25 ? '#ff8888' : '#ffeeee',
                            textShadow: '1px 1px 1px #000000, 0px 0px 2px #aa2222',
                        }}
                    />
                </Panel>
            </Panel>
        </Panel>
    );
};

export default EnemyPanel;
