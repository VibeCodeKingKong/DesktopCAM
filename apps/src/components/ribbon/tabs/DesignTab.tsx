import { Circle, Cog, FileUp, Mountain, MousePointer2, PenTool, Slash, Spline, Square, Type } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup, RibbonStack } from '../RibbonGroup';
import { addCircle, addGear, addRectangle, importVectorFile, notYet } from '../../../cam/commands';
import { useAppStore } from '../../../store/useAppStore';
import { IlluCircle, IlluCurve, IlluImport, IlluRect, IlluRelief } from '../../smartguide/illustrations';

export function DesignTab() {
  const openDialog = useAppStore((s) => s.openDialog);
  return (
    <>
      <RibbonGroup label="Markera">
        <RibbonButton
          icon={MousePointer2}
          label="Markera"
          active
          onClick={() => undefined}
          tooltip={{ title: 'Markera', description: 'Klicka på former i projektträdet för att välja dem. Skift-klick lägger till fler.', shortcut: 'Esc' }}
        />
        <RibbonButton
          icon={PenTool}
          label="Noder"
          onClick={() => notYet('Nodredigering')}
          tooltip={{ title: 'Redigera noder', description: 'Dra i punkterna på en form för att ändra den. Dubbelklicka för att lägga till en punkt.', illustration: <IlluCurve /> }}
        />
      </RibbonGroup>
      <RibbonGroup label="Rita">
        <RibbonButton
          icon={Square}
          label="Rektangel"
          onClick={addRectangle}
          tooltip={{ title: 'Rektangel', description: 'Lägger till en rektangel mitt på materialet. Ändra mått i egenskapspanelen.', shortcut: 'R', illustration: <IlluRect /> }}
        />
        <RibbonButton
          icon={Circle}
          label="Cirkel"
          onClick={addCircle}
          tooltip={{ title: 'Cirkel', description: 'Lägger till en cirkel med 50 mm diameter mitt på materialet.', shortcut: 'C', illustration: <IlluCircle /> }}
        />
        <RibbonStack>
          <RibbonButton size="small" icon={Slash} label="Linje" onClick={() => notYet('Linjeverktyget')} tooltip={{ title: 'Linje', description: 'Klicka för att sätta ut punkter. Dubbelklicka för att avsluta.', shortcut: 'L' }} />
          <RibbonButton size="small" icon={Spline} label="Bézierkurva" onClick={() => notYet('Bézierkurvor')} tooltip={{ title: 'Bézierkurva', description: 'Dra från varje punkt för att forma mjuka kurvor.', illustration: <IlluCurve /> }} />
          <RibbonButton size="small" icon={Cog} label="Kugghjul" onClick={addGear} tooltip={{ title: 'Kugghjul', description: 'Lägger till ett kugghjul med 14 kuggar – bra att testa verktygsbanor på.' }} />
        </RibbonStack>
        <RibbonButton
          icon={Type}
          label="Text"
          onClick={() => notYet('Textverktyget')}
          tooltip={{ title: 'Text', description: 'Skriv text med valfritt typsnitt. Texten blir vektorer som kan fräsas eller laserskäras.', shortcut: 'T' }}
        />
      </RibbonGroup>
      <RibbonGroup label="Importera">
        <RibbonButton
          icon={FileUp}
          label="SVG / DXF"
          onClick={() => void importVectorFile()}
          tooltip={{
            title: 'Importera vektorer',
            description: 'Hämtar in ritningar från Inkscape, Illustrator, Fusion 360 eller LibreCAD. Du kan också dra filen till 3D-vyn.',
            shortcut: '⌘I',
            illustration: <IlluImport />,
          }}
        />
      </RibbonGroup>
      <RibbonGroup label="Bibliotek">
        <RibbonButton
          icon={Mountain}
          label="Relief­bibliotek"
          onClick={() => openDialog('reliefLibrary')}
          tooltip={{
            title: 'Reliefbibliotek',
            description: 'Färdiga 3D-motiv – kupoler, stjärnor, mönster och löv – att placera på materialet och fräsa med kulfräs.',
            illustration: <IlluRelief />,
          }}
        />
      </RibbonGroup>
    </>
  );
}
