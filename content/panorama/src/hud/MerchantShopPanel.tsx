/**
 * MerchantShopPanel.tsx
 * 八荒演武 - 修炼商店面板
 * 布局: NPC肖像(左) + 玉面板(右/中)
 * 使用 slot_1~8.png 图片作为技能格子
 */

import React, { useEffect, useState } from 'react';

// 技能槽位数据
interface SkillSlot {
    id: number;
    name: string;
    stat: string;
    bonus: string;
    purchased: boolean;
}

// 全局费用
const SLOT_COST = 200;

// 8个技能配置 (带描述)
const SKILL_CONFIG: SkillSlot[] = [
    { id: 1, name: '体魄', stat: '+5', bonus: '生命', purchased: false },
    { id: 2, name: '武道', stat: '+5', bonus: '攻击', purchased: false },
    { id: 3, name: '神意', stat: '+5', bonus: '法力', purchased: false },
    { id: 4, name: '戒寺', stat: '+10', bonus: '护甲', purchased: false },
    { id: 5, name: '回能', stat: '+1', bonus: '回复', purchased: false },
    { id: 6, name: '吸渍', stat: '+1%', bonus: '吸血', purchased: false },
    { id: 7, name: '护斥', stat: '+2', bonus: '减伤', purchased: false },
    { id: 8, name: '敏速', stat: '+30', bonus: '移速', purchased: false },
];

// 技能描述 (用于悬浮窗)
const SKILL_DESC: Record<string, string> = {
    '体魄': '肉身根基',
    '武道': '勇猛精进',
    '神意': '神魂凝练',
    '戒寺': '金刚不坏',
    '回能': '生生不息',
    '吸渍': '以战养战',
    '护斥': '护体真气',
    '敏速': '身法如风',
};

// 槽位图片路径 (100x100px 填满版本)
const SLOT_IMAGES = [
    "file://{resources}/images/slot_1_new.png",
    "file://{resources}/images/slot_2_new.png",
    "file://{resources}/images/slot_3_new.png",
    "file://{resources}/images/slot_4_new.png",
    "file://{resources}/images/slot_5_new.png",
    "file://{resources}/images/slot_6_new.png",
    "file://{resources}/images/slot_7_new.png",
    "file://{resources}/images/slot_8_new.png",
];

// 槽位位置配置 (4x2网格, 居中)
const SLOT_POSITIONS = [
    // 第一行
    { x: 100, y: 180 },
    { x: 210, y: 180 },
    { x: 320, y: 180 },
    { x: 430, y: 180 },
    // 第二行
    { x: 100, y: 245 },
    { x: 210, y: 245 },
    { x: 320, y: 245 },
    { x: 430, y: 245 },
];

const MerchantShopPanel: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [skills, setSkills] = useState<SkillSlot[]>(SKILL_CONFIG);
    const [hoveredSkill, setHoveredSkill] = useState<{ skill: SkillSlot; index: number } | null>(null);
    const [currentTier, setCurrentTier] = useState(1);

    // 检查是否所有技能都购买了
    const allPurchased = skills.every(s => s.purchased);
    // 已购买数量
    const purchasedCount = skills.filter(s => s.purchased).length;
    // 未购买数量
    const unpurchasedCount = skills.filter(s => !s.purchased).length;
    // 全修需要的总金币
    const totalCostForAll = unpurchasedCount * SLOT_COST;
    // 检查是否有足够金币 (简化版 - 之后可以接入真实经济系统)
    const [playerGold, setPlayerGold] = useState(9999); // TODO: 从经济系统获取
    const canAffordAll = playerGold >= totalCostForAll && unpurchasedCount > 0;

    // handleClose 引用 - 需要在 useEffect 之前定义
    const handleCloseRef = React.useRef<() => void>(() => {});
    
    // 检测点击商人打开面板 + 右键关闭
    useEffect(() => {
        const checkMerchantClick = () => {
            const selectedEntity = Players.GetLocalPlayerPortraitUnit();
            
            if (selectedEntity === -1) return;
            
            const unitName = Entities.GetUnitName(selectedEntity);
            const isMerchant = unitName === 'npc_cultivation_merchant';

            // 打开逻辑: 商人被选中且面板不可见
            if (isMerchant && !isVisible) {
                setIsVisible(true);
                Game.EmitSound('Shop.PanelUp');
            }
            
            // 关闭逻辑: 面板可见 + 右键按下
            const isRightDown = GameUI.IsMouseDown(1) || GameUI.IsMouseDown(2);
            if (isVisible && isRightDown) {
                handleCloseRef.current();
            }
        };

        $.Schedule(0.2, function loop() {
            checkMerchantClick();
            $.Schedule(0.2, loop);
        });
    }, [isVisible]);
    
    
    // ESC 键关闭
    useEffect(() => {
        if (isVisible) {
            // 注册 ESC 键监听
            $.RegisterKeyBind($.GetContextPanel(), 'key_escape', () => {
                handleCloseRef.current();
            });
        }
    }, [isVisible]);

    const handleClose = () => {
        setIsVisible(false);
        Game.EmitSound('Shop.PanelDown');
        
        // 强制选中玩家英雄，这样商人就被取消选中了
        // 下次点击商人才会被检测为"新选中"
        const localPlayer = Players.GetLocalPlayer();
        const heroIndex = Players.GetPlayerHeroEntityIndex(localPlayer);
        if (heroIndex !== -1) {
            GameUI.SelectUnit(heroIndex, false);
        }
    };

    const handlePurchase = (skill: SkillSlot) => {
        if (skill.purchased) return;
        
        setSkills(skills.map(s => 
            s.id === skill.id ? { ...s, purchased: true } : s
        ));
        Game.EmitSound('General.Buy');
    };

    const handlePurchaseAll = () => {
        // 全修 - 购买所有未购买的槽位
        setSkills(skills.map(s => ({ ...s, purchased: true })));
        Game.EmitSound('General.Buy');
        Game.EmitSound('Hero_Invoker.LevelUp');
    };

    if (!isVisible) return null;

    // 更新 handleCloseRef
    handleCloseRef.current = handleClose;

    return (
        <Panel style={styles.overlay} hittest={false} hittestchildren={true}>
            {/* 主包装容器 - NPC肖像 + 玉面板 */}
            <Panel style={styles.merchantWrapper}>
                
                {/* NPC肖像 (左侧) - 呼吸动画 */}
                <Image 
                    src="file://{resources}/images/shop_01.png"
                    style={styles.npcPortrait}
                    className="NpcBreathing"
                />

                {/* 玉面板容器 (右侧) */}
                <Panel style={styles.panelContainer}>
                    {/* 背景图 */}
                    <Image 
                        src="file://{resources}/images/shop_panel_large.png"
                        style={styles.background}
                    />
                    
                    {/* 标题 */}
                    <Label 
                        text={`修炼境界 · 第${currentTier}重`}
                        style={styles.title}
                    />

                    {/* 技能槽位网格 (使用图片) */}
                    {skills.map((skill, index) => (
                        <Panel
                            key={skill.id}
                            style={{
                                ...styles.skillSlot,
                                position: `${SLOT_POSITIONS[index].x}px ${SLOT_POSITIONS[index].y}px 0px`,
                            }}
                            onmouseover={() => setHoveredSkill({ skill, index })}
                            onmouseout={() => setHoveredSkill(null)}
                            onactivate={() => handlePurchase(skill)}
                        >
                            {/* 槽位图片 */}
                            <Image 
                                src={SLOT_IMAGES[index]}
                                style={{
                                    ...styles.slotImage,
                                    ...(!skill.purchased ? styles.slotDimmed : styles.slotBright),
                                }}
                            />
                            
                            {/* 未购买遮罩 (暗淡) */}
                            {!skill.purchased && (
                                <Panel style={styles.dimmedOverlay} />
                            )}
                        </Panel>
                    ))}

                    {/* "全修"图标按钮 - 红金燃烧特效 */}
                    <Panel
                        style={styles.purchaseAllSlot}
                        onactivate={handlePurchaseAll}
                        className="BreathScale"
                    >
                        {/* 图标 + 燃烧效果 */}
                        <Image 
                            src="file://{resources}/images/slot_quan_new2.png"
                            style={styles.slotImage}
                            className="BurningImage"
                        />
                    </Panel>

                    {/* 底部区域 - 费用显示 */}
                    <Panel style={styles.costBar}>
                        <Label 
                            text={`【 演 武 代 价 ：${SLOT_COST} 灵石 / 式 】`}
                            style={styles.costTitle}
                        />
                    </Panel>

                    {/* 悬浮提示 - 暖玉琥珀风格 */}
                    {hoveredSkill && (
                        <Panel 
                            style={{
                                ...styles.tooltip,
                                position: `${SLOT_POSITIONS[hoveredSkill.index].x + 60}px ${SLOT_POSITIONS[hoveredSkill.index].y - 20}px 0px`,
                            }}
                            className="JadeTooltip"
                        >
                            {/* 标题 */}
                            <Label text={hoveredSkill.skill.name} style={styles.tooltipTitle} />
                            {/* 分割线 */}
                            <Panel style={styles.tooltipDivider} />
                            {/* 描述 */}
                            <Label text={SKILL_DESC[hoveredSkill.skill.name] || ''} style={styles.tooltipDesc} />
                            {/* 数值 */}
                            <Panel style={styles.tooltipValueRow}>
                                <Label text={hoveredSkill.skill.stat} style={styles.tooltipValue} />
                                <Label text={` ${hoveredSkill.skill.bonus}`} style={styles.tooltipBonus} />
                            </Panel>
                        </Panel>
                    )}

                </Panel>
            </Panel>
        </Panel>
    );
};

const styles = {
    overlay: {
        width: '100%',
        height: '100%',
    },
    
    // 主包装器 - 水平布局 (NPC + 面板)
    merchantWrapper: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'bottom' as const,
        marginBottom: '0px',
        marginLeft: '150px',
    },
    
    // NPC肖像
    npcPortrait: {
        width: '350px',
        height: '500px',
        marginRight: '-40px',
    },
    
    // 玉面板容器
    panelContainer: {
        width: '680px',
        height: '420px',
    },
    
    // 背景图
    background: {
        width: '680px',
        height: '420px',
        position: '0px 30px 0px' as const,
    },
    
    // 标题
    title: {
        color: '#ffd700',
        fontSize: '22px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 10px #ffd700',
        horizontalAlign: 'center' as const,
        letterSpacing: '4px',
        position: '0px 85px 0px' as const,
        width: '100%',
        textAlign: 'center' as const,
    },
    
    // 技能槽位容器 - 点击区域和图片大小一致
    skillSlot: {
        width: '50px',
        height: '50px',
    },
    
    // 槽位图片 - 填满容器
    slotImage: {
        width: '100%',
        height: '100%',
    },
    
    // 槽位图片 - 绝对定位 (用于全修按钮)
    slotImageAbsolute: {
        width: '100%',
        height: '100%',
        position: '0px 0px 0px' as const,
    },
    
    // 未购买的槽位 (灰暗化)
    slotDimmed: {
        opacity: '0.4',
        saturation: '0.2',
        brightness: '0.6',
    },
    
    // 已购买的槽位 (原图亮度)
    slotBright: {
        opacity: '1.0',
        saturation: '1.0',
        brightness: '1.0',
    },
    
    // 未购买遮罩
    dimmedOverlay: {
        width: '100%',
        height: '100%',
        position: '0px 0px 0px' as const,
        border: '2px solid #445555',
        borderRadius: '6px',
        backgroundColor: 'rgba(15, 25, 25, 0.5)',
    },
    
    // 底部费用栏 - 置于面板内部
    costBar: {
        flowChildren: 'down' as const,
        position: '120px 315px 0px' as const,
        width: '400px',
        horizontalAlign: 'left' as const,
    },
    
    // 费用标题
    costTitle: {
        color: '#c9a861',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '2px',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
    },
    
    // 费用数值行
    costValueRow: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        marginTop: '2px',
    },
    
    // 费用数值
    costValue: {
        color: '#ffdd44',
        fontSize: '20px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #ffd700',
    },
    
    // 费用单位
    costUnit: {
        color: '#d4c4a8',
        fontSize: '16px',
        verticalAlign: 'bottom' as const,
        marginBottom: '1px',
    },
    
    // "全修"图标按钮 - 位于第二行右侧
    purchaseAllSlot: {
        width: '50px',
        height: '50px',
        position: '525px 220px 0px' as const,
        borderRadius: '6px',
    },
    
    // 全修按钮 (文字按钮)
    purchaseAllBtn: {
        backgroundColor: '#884422',
        border: '2px solid #ffaa66',
        borderRadius: '8px',
        padding: '8px 24px',
        verticalAlign: 'center' as const,
    },
    
    // 全修按钮文字
    purchaseAllText: {
        color: '#ffd700',
        fontSize: '28px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #ff8800',
    },
    
    // 悬浮提示 - 青玉风格
    tooltip: {
        flowChildren: 'down' as const,
        width: '130px',
        padding: '12px 16px',
        // 青绿玉色背景 + 金边
        backgroundColor: 'rgba(25, 50, 55, 0.95)',
        border: '1px solid #c9a861',
        borderRadius: '6px',
        // 青绿色光晕
        boxShadow: '0px 0px 12px 4px rgba(60, 120, 110, 0.35), inset 0px 0px 15px rgba(40, 80, 75, 0.25)',
    },
    tooltipTitle: {
        color: '#ffd780',
        fontSize: '18px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 8px #c9a861',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        letterSpacing: '4px',
        marginBottom: '4px',
    },
    tooltipDivider: {
        width: '80%',
        height: '1px',
        backgroundColor: '#c9a861',
        horizontalAlign: 'center' as const,
        marginTop: '2px',
        marginBottom: '6px',
        opacity: '0.6',
    },
    tooltipDesc: {
        color: '#d4c4a8',
        fontSize: '12px',
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        opacity: '0.85',
        marginBottom: '6px',
    },
    tooltipValueRow: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
    },
    tooltipValue: {
        color: '#66ff88',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        textShadow: '0px 0px 6px #44cc66',
    },
    tooltipBonus: {
        color: '#e8d8b8',
        fontSize: '14px',
    },
    

};

export default MerchantShopPanel;
