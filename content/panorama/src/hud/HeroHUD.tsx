import { type FC, useState, useEffect } from 'react';

// 职业名称映射
const JOB_NAME_MAP: { [key: string]: string } = {
    "bing_shen_dao": "兵神道",
    // 其他职业映射
};

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
}

/**
 * 英雄HUD组件 - 底部信息栏
 * 头像框在背景内部左侧
 */
const HeroHUD: FC = () => {
    const [professionName, setProfessionName] = useState("...");
    const [stats, setStats] = useState<HeroStats>({
        attack: 0,
        defense: 0,
        constitution: 0,
        martial: 0,
        divinity: 0,
    });

    useEffect(() => {
        // 获取攻击和防御 (来自 Entities API)
        const updateApiStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const damageMin = Entities.GetDamageMin(localHero);
            const damageBonus = Entities.GetDamageBonus(localHero);
            const armor = Entities.GetPhysicalArmorValue(localHero);

            setStats(prev => ({
                ...prev,
                attack: damageMin + damageBonus,
                defense: Math.floor(armor),
            }));
        };

        // 获取职业和自定义属性 (来自 NetTable)
        const updateNetTableStats = () => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (localHero === -1) return;

            const netTableKey = String(localHero);
            const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, netTableKey);

            $.Msg("[HeroHUD] NetTable key:", netTableKey, "data:", JSON.stringify(netTableData));

            if (netTableData) {
                // 职业
                const professionKey = (netTableData as any).profession;
                $.Msg("[HeroHUD] profession:", professionKey);
                if (professionKey && professionKey !== "undefined") {
                    setProfessionName(JOB_NAME_MAP[professionKey] || professionKey);
                }

                // 根骨、武道、神念
                const constitution = (netTableData as any).constitution || 0;
                const martial = (netTableData as any).martial || 0;
                const divinity = (netTableData as any).divinity || 0;
                $.Msg("[HeroHUD] constitution:", constitution, "martial:", martial, "divinity:", divinity);
                
                setStats(prev => ({
                    ...prev,
                    constitution: constitution,
                    martial: martial,
                    divinity: divinity,
                }));
            }
        };

        // 延迟初始化，确保英雄实体准备好
        $.Schedule(0.5, () => {
            updateApiStats();
            updateNetTableStats();
        });

        // 监听 NetTable 变化 (事件驱动)
        CustomNetTables.SubscribeNetTableListener('custom_stats' as any, (table, key, data) => {
            const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
            if (key === String(localHero)) {
                $.Msg("[HeroHUD] NetTable changed, updating...");
                updateNetTableStats();
            }
        });

        // 定时更新所有数据（确保即使初始化时机不对也能更新）
        $.Schedule(1.0, function loop() {
            updateApiStats();
            updateNetTableStats();
            $.Schedule(2.0, loop); // 每2秒更新一次NetTable数据
        });
    }, []);

    return (
        <Panel style={{
            horizontalAlign: 'center' as const,
            verticalAlign: 'bottom' as const,
            marginBottom: '0px',
            width: '900px',
            height: '500px',
        }}>
            {/* 主HUD背景横条 */}
            <Image 
                src="file://{resources}/images/hud_bar_wide.png"
                style={{
                    width: '900px',
                    height: '500px',
                    position: '0px 160px 0px' as const,
                }}
            />
            
            {/* 头像框 - 在背景内部左侧 */}
            <Panel style={{
                width: '210px',
                height: '250px',
                position: '60px 295px 0px' as const,
                flowChildren: 'down' as const,
            }}>
                <Image 
                    src="file://{resources}/images/hero_portrait_frame_v2.png"
                    style={{
                        width: '210px',
                        height: '210px',
                    }}
                />
                {/* 英雄职业名称 - 从NetTable获取 */}
                <Label 
                    text={professionName}
                    style={{
                        fontSize: '22px',
                        fontWeight: 'bold' as const,
                        fontFamily: 'SimHei, Microsoft YaHei, sans-serif',
                        color: '#f0d080',
                        textShadow: '0px 0px 4px #ffcc00, 0px 1px 2px #000000',
                        horizontalAlign: 'center' as const,
                        textAlign: 'center' as const,
                        letterSpacing: '2px',
                        marginTop: '-48px',
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
        </Panel>
    );
};

export default HeroHUD;
