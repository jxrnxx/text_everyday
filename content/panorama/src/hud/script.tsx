import 'panorama-polyfill-x/lib/console';
import 'panorama-polyfill-x/lib/timers';

/** 隐藏一些默认的UI元素 */
import '../utils/hide-default-hud';

import { type FC } from 'react';
import { render } from 'react-panorama-x';
import GameTimer from './GameTimer';
import InvitationCode from './InvitationCode';
import EconomyDisplay from './EconomyDisplay';
import TrainingButtons from './TrainingButtons';
import RankUpButton from './RankUpButton';
import MerchantShopPanel from './MerchantShopPanel';
import BackToLobbyButton from './BackToLobbyButton';

const Root: FC = () => {
    return (
        <>
            <BackToLobbyButton />
            <GameTimer />
            <InvitationCode />
            <EconomyDisplay />
            <TrainingButtons />
            <RankUpButton />
            <MerchantShopPanel />
        </>
    );
};

render(<Root />, $.GetContextPanel());

// Helper: Reload Scripts with 'R' (Only in Tools Mode)
if (Game.IsInToolsMode()) {
    $.RegisterKeyBind($.GetContextPanel(), 'key_r', () => {
        Game.ServerCmd('dota_reload_addon_script');
    });
}

// ===== Training Room Keybinds (F3/F4) =====
// Disable default UI that conflicts with F3/F4
// 8 = Shop (F4), 17 = Courier (F3)
GameUI.SetDefaultUIEnabled(8, false);   // Disable Shop UI (F4)
GameUI.SetDefaultUIEnabled(17, false);  // Disable Courier UI (F3)

// Get local player ID
const localPlayerId = Game.GetLocalPlayerID();

// Build command strings with player ID
const cmdEnter = `cmd_train_enter ${localPlayerId}`;
const cmdExit = `cmd_train_exit ${localPlayerId}`;

// Bind F3 and F4 keys
Game.CreateCustomKeyBind('F3', cmdEnter);
Game.CreateCustomKeyBind('F4', cmdExit);
