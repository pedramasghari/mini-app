import PanelShell from '@/components/panel/PanelShell';
import {PanelProvider} from '@/context/PanelContext';

export default function PanelPage(){return <PanelProvider><PanelShell/></PanelProvider>}
