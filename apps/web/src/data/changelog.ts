/**
 * Versionshistorik som visas i appen (Om desktopCAM → Nyheter).
 * Lägg till en ny post överst och höj versionen i apps/web/package.json
 * (och i roten) vid varje uppdatering. Den översta posten ska ha samma
 * version som package.json – det kontrolleras när appen startar i dev-läge.
 *
 * Varje post måste ha text på alla språk i appen – typen kräver det.
 */
import type { Language } from '../i18n/initial';

export interface ChangelogEntry {
  version: string;
  date: string;
  text: Record<Language, string[]>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.19.0',
    date: '2026-11-14',
    text: {
      sv: [
        'Nya riktvärden: plasma för hobbyaggregat 40–60 A (t.ex. 3 mm stål: 55 A och 2500 mm/min). Fräsdata skalas efter spindelns varvtal, maskinens styvhet och fräsens storlek, och laserdata efter laserns effekt och materialets tjocklek – med varning när materialet är för tjockt.',
        'Mindre G-kod: cirkelbågar skrivs som G2/G3 och raka sträckor slås ihop (kan stängas av under Maskininställning → Postprocessor). En cirkel som fräses blev ca 10 gånger mindre.',
        'Plasma: sakta ner i skarpa hörn, och egen matning för inlöp och utlöp.',
        'Rättat: banor från avståndsfältet hade ett litet sicksackbrus (upp till en halv ruta) som gav tusentals mikrosegment och ryckig rörelse. Konturerna läggs nu exakt, och kurvor delas upp tio gånger finare.',
      ],
      en: [
        'New guide values: plasma for 40–60 A hobby units (e.g. 3 mm steel: 55 A and 2500 mm/min). Router data scales with spindle speed, machine rigidity and cutter size, and laser data with laser power and material thickness – with a warning when the material is too thick.',
        'Smaller G-code: circular arcs are written as G2/G3 and straight runs are merged (can be turned off under Machine setup → Post-processor). A milled circle became about 10 times smaller.',
        'Plasma: slow down in sharp corners, and separate feeds for lead-in and lead-out.',
        'Fixed: paths from the distance field had a slight zigzag noise (up to half a cell) that gave thousands of micro-segments and jerky motion. Contours are now placed exactly, and curves are divided ten times finer.',
      ],
      fr: [
        'Nouvelles valeurs indicatives : plasma pour générateurs de loisir 40–60 A (par ex. acier 3 mm : 55 A et 2500 mm/min). Les données de fraisage suivent la vitesse de broche, la rigidité de la machine et la taille de la fraise, et celles du laser sa puissance et l’épaisseur – avec un avertissement si le matériau est trop épais.',
        'G-code plus compact : les arcs sont écrits en G2/G3 et les tronçons droits fusionnés (désactivable dans Configuration machine → Post-processeur). Un cercle fraisé est devenu environ 10 fois plus petit.',
        'Plasma : ralentissement dans les angles vifs et avances distinctes pour l’entrée et la sortie.',
        'Corrigé : les parcours issus du champ de distance avaient un léger bruit en zigzag (jusqu’à une demi-cellule) qui donnait des milliers de micro-segments et des mouvements saccadés. Les contours sont maintenant placés exactement et les courbes divisées dix fois plus finement.',
      ],
      de: [
        'Neue Richtwerte: Plasma für Hobbygeräte mit 40–60 A (z. B. 3 mm Stahl: 55 A und 2500 mm/min). Fräsdaten richten sich nach Spindeldrehzahl, Steifigkeit der Maschine und Fräsergröße, Laserdaten nach Laserleistung und Materialdicke – mit Warnung, wenn das Material zu dick ist.',
        'Kleinerer G-Code: Kreisbögen werden als G2/G3 geschrieben und gerade Abschnitte zusammengefasst (abschaltbar unter Maschineneinrichtung → Postprozessor). Ein gefräster Kreis wurde etwa 10-mal kleiner.',
        'Plasma: langsamer in scharfen Ecken und eigener Vorschub für An- und Abfahrt.',
        'Behoben: Bahnen aus dem Distanzfeld hatten ein leichtes Zickzack-Rauschen (bis zu einer halben Zelle), das Tausende Mikrosegmente und ruckelnde Bewegungen erzeugte. Konturen werden jetzt exakt gelegt und Kurven zehnmal feiner unterteilt.',
      ],
      es: [
        'Nuevos valores orientativos: plasma para equipos de aficionado de 40–60 A (p. ej. acero de 3 mm: 55 A y 2500 mm/min). Los datos de fresado se ajustan a la velocidad del husillo, la rigidez de la máquina y el tamaño de la fresa, y los del láser a su potencia y al grosor, con aviso cuando el material es demasiado grueso.',
        'G-code más pequeño: los arcos se escriben como G2/G3 y los tramos rectos se unen (se puede desactivar en Configuración de máquina → Posprocesador). Un círculo fresado quedó unas 10 veces más pequeño.',
        'Plasma: frenado en esquinas vivas y avances propios para entrada y salida.',
        'Corregido: las trayectorias del campo de distancia tenían un ligero ruido en zigzag (hasta media celda) que daba miles de microsegmentos y movimientos bruscos. Ahora los contornos se colocan con exactitud y las curvas se dividen diez veces más fino.',
      ],
      pl: [
        'Nowe wartości orientacyjne: plazma dla urządzeń hobbystycznych 40–60 A (np. stal 3 mm: 55 A i 2500 mm/min). Dane frezowania zależą od obrotów wrzeciona, sztywności maszyny i rozmiaru frezu, a lasera od jego mocy i grubości materiału – z ostrzeżeniem, gdy materiał jest za gruby.',
        'Mniejszy G-code: łuki zapisywane jako G2/G3, proste odcinki łączone (można wyłączyć w Ustawieniach maszyny → Postprocesor). Frezowany okrąg stał się ok. 10 razy mniejszy.',
        'Plazma: zwalnianie w ostrych narożnikach i osobny posuw wejścia i wyjścia.',
        'Poprawiono: ścieżki z pola odległości miały lekki szum zygzakowaty (do pół komórki), który dawał tysiące mikroodcinków i szarpany ruch. Kontury są teraz wyznaczane dokładnie, a krzywe dzielone dziesięć razy drobniej.',
      ],
      uk: [
        'Нові орієнтовні значення: плазма для аматорських апаратів 40–60 A (напр. сталь 3 мм: 55 A і 2500 мм/хв). Дані фрезерування залежать від обертів шпинделя, жорсткості верстата й розміру фрези, а лазера – від його потужності й товщини матеріалу, з попередженням, коли матеріал задовгий.',
        'Менший G-код: дуги записуються як G2/G3, прямі ділянки об’єднуються (можна вимкнути в Налаштуваннях верстата → Постпроцесор). Фрезероване коло стало приблизно в 10 разів меншим.',
        'Плазма: сповільнення в гострих кутах і окрема подача на вході й виході.',
        'Виправлено: траєкторії з поля відстаней мали легкий зигзагоподібний шум (до половини клітинки), що давав тисячі мікросегментів і ривки. Тепер контури будуються точно, а криві діляться вдесятеро дрібніше.',
      ],
    },
  },
  {
    version: '0.18.0',
    date: '2026-11-12',
    text: {
      sv: [
        'Två knappar för vyn: Arbetsstycke zoomar in på materialet (S) och Arbetsyta visar hela maskinens arbetsyta (F). Inramningen passar nu även en stående mobilskärm.',
        'Rättat: laser- och plasmasnitt såg hackiga ut i simuleringen – snittkanterna kantutjämnas nu som vid fräsning. Själva G-koden var redan jämn.',
      ],
      en: [
        'Two view buttons: Workpiece zooms in on the material (S) and Work area shows the machine’s whole work area (F). The framing now also fits a phone held upright.',
        'Fixed: laser and plasma cuts looked jagged in the simulation – the cut edges are now anti-aliased as for milling. The G-code itself was already smooth.',
      ],
      fr: [
        'Deux boutons de vue : Pièce zoome sur le matériau (S) et Zone de travail montre toute la zone de la machine (F). Le cadrage convient aussi à un téléphone en portrait.',
        'Corrigé : les découpes laser et plasma paraissaient crénelées dans la simulation – les bords sont maintenant lissés comme pour le fraisage. Le G-code lui-même était déjà lisse.',
      ],
      de: [
        'Zwei Ansichtsknöpfe: Werkstück zoomt auf das Material (S), Arbeitsbereich zeigt den ganzen Arbeitsbereich der Maschine (F). Der Ausschnitt passt jetzt auch auf ein Handy im Hochformat.',
        'Behoben: Laser- und Plasmaschnitte sahen in der Simulation gezackt aus – die Schnittkanten werden jetzt wie beim Fräsen geglättet. Der G-Code selbst war bereits glatt.',
      ],
      es: [
        'Dos botones de vista: Pieza acerca la vista al material (S) y Área de trabajo muestra toda el área de la máquina (F). El encuadre ahora también sirve para un móvil en vertical.',
        'Corregido: los cortes láser y plasma se veían dentados en la simulación; ahora los bordes se suavizan como en el fresado. El G-code ya era suave.',
      ],
      pl: [
        'Dwa przyciski widoku: Materiał przybliża do materiału (S), a Obszar roboczy pokazuje cały obszar maszyny (F). Kadr pasuje teraz też do telefonu w pionie.',
        'Poprawiono: cięcia laserem i plazmą wyglądały w symulacji na poszarpane – krawędzie są teraz wygładzane jak przy frezowaniu. Sam G-code był już gładki.',
      ],
      uk: [
        'Дві кнопки виду: Заготовка наближає до матеріалу (S), а Робоче поле показує все поле верстата (F). Кадрування тепер пасує й до телефона у вертикальному положенні.',
        'Виправлено: лазерні та плазмові різи в симуляції виглядали зубчастими – краї різу тепер згладжуються, як при фрезеруванні. Сам G-код уже був гладким.',
      ],
    },
  },
  {
    version: '0.17.0',
    date: '2026-11-12',
    text: {
      sv: [
        'Plasmaskärning: ny maskintyp med CrossFire, CrossFire PRO och egen GRBL-plasma, plasmabrännare i verktygsbiblioteket och en ny bana för plasmaskärning.',
        'Strålkompensation, inlöp och utlöp (båge eller linje) i spillet, överskärning, genomstickningshöjd och väntetid, skärhöjd och höjdavkänning (IHS) med G38.2.',
        'Hål skärs före ytterkonturen och långsammare när de är små, och höjdregleringen (THC) kan stängas av i små hål.',
        'Skärtabeller för stål, rostfritt och aluminium fyller i ström, matning, snittbredd och väntetid efter plåtens tjocklek. Simuleringen visar plasmasnittet.',
      ],
      en: [
        'Plasma cutting: a new machine type with CrossFire, CrossFire PRO and a custom GRBL plasma, plasma torches in the tool library and a new plasma cutting toolpath.',
        'Kerf compensation, lead-in and lead-out (arc or line) in the scrap, overcut, pierce height and delay, cut height and height sensing (IHS) with G38.2.',
        'Holes are cut before the outline and slower when they are small, and torch height control (THC) can be turned off in small holes.',
        'Cut charts for steel, stainless and aluminium fill in current, feed, kerf and pierce delay from the plate thickness. The simulation shows the plasma cut.',
      ],
      fr: [
        'Découpe plasma : nouveau type de machine avec CrossFire, CrossFire PRO et plasma GRBL personnalisé, torches plasma dans la bibliothèque d’outils et nouveau parcours de découpe plasma.',
        'Compensation de saignée, entrée et sortie (arc ou ligne) dans la chute, surcoupe, hauteur et temporisation de perçage, hauteur de coupe et palpage (IHS) par G38.2.',
        'Les trous sont découpés avant le contour et plus lentement quand ils sont petits ; le THC peut être coupé dans les petits trous.',
        'Tables de coupe pour l’acier, l’inox et l’aluminium : courant, avance, saignée et temporisation selon l’épaisseur. La simulation montre la coupe plasma.',
      ],
      de: [
        'Plasmaschneiden: neuer Maschinentyp mit CrossFire, CrossFire PRO und eigenem GRBL-Plasma, Plasmabrenner in der Werkzeugbibliothek und eine neue Bahn für das Plasmaschneiden.',
        'Schnittspaltkorrektur, An- und Abfahrt (Bogen oder Linie) im Verschnitt, Überschnitt, Einstechhöhe und -verzögerung, Schneidhöhe und Höhenabtastung (IHS) mit G38.2.',
        'Löcher werden vor der Außenkontur geschnitten und langsamer, wenn sie klein sind; die Höhenregelung (THC) lässt sich in kleinen Löchern abschalten.',
        'Schneidtabellen für Stahl, Edelstahl und Aluminium setzen Strom, Vorschub, Schnittspalt und Einstechverzögerung nach Blechdicke. Die Simulation zeigt den Plasmaschnitt.',
      ],
      es: [
        'Corte por plasma: nuevo tipo de máquina con CrossFire, CrossFire PRO y plasma GRBL propio, antorchas de plasma en la biblioteca de herramientas y una nueva trayectoria de corte por plasma.',
        'Compensación de sangría, entrada y salida (arco o línea) en el retal, sobrecorte, altura y retardo de perforación, altura de corte y detección de altura (IHS) con G38.2.',
        'Los agujeros se cortan antes que el contorno y más despacio cuando son pequeños, y el control de altura (THC) se puede desactivar en ellos.',
        'Tablas de corte para acero, inoxidable y aluminio: corriente, avance, sangría y retardo según el grosor de la chapa. La simulación muestra el corte por plasma.',
      ],
      pl: [
        'Cięcie plazmą: nowy typ maszyny z CrossFire, CrossFire PRO i własną plazmą GRBL, palniki plazmowe w bibliotece narzędzi i nowa ścieżka cięcia plazmą.',
        'Kompensacja szczeliny, wejście i wyjście (łuk lub linia) w odpadzie, przecięcie, wysokość i opóźnienie przebicia, wysokość cięcia i wyczuwanie wysokości (IHS) przez G38.2.',
        'Otwory są cięte przed konturem zewnętrznym i wolniej, gdy są małe, a regulację wysokości (THC) można w nich wyłączyć.',
        'Tabele cięcia dla stali, stali nierdzewnej i aluminium ustawiają prąd, posuw, szczelinę i opóźnienie przebicia według grubości blachy. Symulacja pokazuje cięcie plazmą.',
      ],
      uk: [
        'Плазмове різання: новий тип верстата з CrossFire, CrossFire PRO і власною плазмою GRBL, плазмові різаки в бібліотеці інструментів і нова траєкторія плазмового різання.',
        'Компенсація різу, вхід і вихід (дуга чи лінія) у відході, перекриття, висота й затримка пробивання, висота різання та визначення висоти (IHS) через G38.2.',
        'Отвори ріжуться перед зовнішнім контуром і повільніше, коли вони малі, а регулювання висоти (THC) у них можна вимкнути.',
        'Таблиці різання для сталі, нержавійки й алюмінію задають струм, подачу, ширину різу й затримку пробивання за товщиною листа. Симуляція показує плазмовий різ.',
      ],
    },
  },
  {
    version: '0.16.1',
    date: '2026-11-12',
    text: {
      sv: [
        'Licenser och varumärken under Om desktopCAM: friskrivning, varumärkesinformation och en fil med alla licenser för programvara och typsnitt från tredje part (skapas automatiskt vid varje bygge).',
        'Påminnelse om typsnittslicens när du läser in ett eget typsnitt.',
      ],
      en: [
        'Licences and trademarks under About desktopCAM: disclaimer, trademark notice and a file with all licences for third-party software and fonts (generated automatically on every build).',
        'A reminder about the font licence when you load your own font.',
      ],
      fr: [
        'Licences et marques dans À propos de desktopCAM : avertissement, mention des marques et un fichier avec toutes les licences des logiciels et polices tiers (généré automatiquement à chaque build).',
        'Un rappel sur la licence de la police lorsque vous chargez votre propre police.',
      ],
      de: [
        'Lizenzen und Marken unter Über desktopCAM: Haftungsausschluss, Markenhinweis und eine Datei mit allen Lizenzen für Software und Schriften von Dritten (bei jedem Build automatisch erzeugt).',
        'Ein Hinweis zur Schriftlizenz, wenn Sie eine eigene Schrift laden.',
      ],
      es: [
        'Licencias y marcas en Acerca de desktopCAM: aviso legal, información de marcas y un archivo con todas las licencias del software y las fuentes de terceros (generado automáticamente en cada compilación).',
        'Un recordatorio sobre la licencia al cargar tu propia fuente.',
      ],
      pl: [
        'Licencje i znaki towarowe w O desktopCAM: zastrzeżenie, informacja o znakach towarowych i plik ze wszystkimi licencjami oprogramowania i czcionek innych firm (tworzony automatycznie przy każdej kompilacji).',
        'Przypomnienie o licencji czcionki przy wczytywaniu własnej czcionki.',
      ],
      uk: [
        'Ліцензії та торговельні марки в розділі Про desktopCAM: застереження, інформація про марки й файл з усіма ліцензіями сторонніх програм і шрифтів (створюється автоматично під час кожного збирання).',
        'Нагадування про ліцензію шрифту, коли ви завантажуєте власний шрифт.',
      ],
    },
  },
  {
    version: '0.16.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Papperskorg på varje form, relief och verktygsbana i projektträdet.',
        'Dra verktygsbanorna i projektträdet för att ändra i vilken ordning de körs. Numren i namnen följer med.',
        'Lager: skapa nya lager, byt namn (dubbelklick), gör ett lager aktivt så att nya former hamnar där, markera alla former i ett lager med ett klick och flytta former mellan lager under Egenskaper.',
      ],
      en: [
        'A bin on every shape, relief and toolpath in the project tree.',
        'Drag toolpaths in the project tree to change the order they run in. The numbers in the names follow along.',
        'Layers: create new layers, rename them (double-click), make a layer active so new shapes go there, select all shapes in a layer with one click and move shapes between layers in Properties.',
      ],
      fr: [
        'Une corbeille sur chaque forme, relief et parcours dans l’arborescence du projet.',
        'Faites glisser les parcours dans l’arborescence pour changer leur ordre d’exécution. Les numéros des noms suivent.',
        'Calques : créez des calques, renommez-les (double-clic), activez un calque pour y placer les nouvelles formes, sélectionnez toutes ses formes d’un clic et déplacez des formes entre calques dans Propriétés.',
      ],
      de: [
        'Ein Papierkorb an jeder Form, jedem Relief und jeder Werkzeugbahn im Projektbaum.',
        'Werkzeugbahnen im Projektbaum ziehen, um ihre Reihenfolge zu ändern. Die Nummern in den Namen ziehen mit.',
        'Ebenen: neue Ebenen anlegen, umbenennen (Doppelklick), eine Ebene aktiv setzen, damit neue Formen dort landen, alle Formen einer Ebene mit einem Klick auswählen und Formen unter Eigenschaften zwischen Ebenen verschieben.',
      ],
      es: [
        'Papelera en cada forma, relieve y trayectoria del árbol del proyecto.',
        'Arrastra las trayectorias en el árbol del proyecto para cambiar el orden en que se ejecutan. Los números de los nombres se actualizan.',
        'Capas: crea capas nuevas, renómbralas (doble clic), activa una capa para que las formas nuevas vayan ahí, selecciona todas sus formas con un clic y mueve formas entre capas en Propiedades.',
      ],
      pl: [
        'Kosz przy każdym kształcie, reliefie i ścieżce w drzewie projektu.',
        'Przeciągaj ścieżki w drzewie projektu, aby zmienić kolejność ich wykonywania. Numery w nazwach się aktualizują.',
        'Warstwy: twórz nowe warstwy, zmieniaj nazwy (dwuklik), uaktywnij warstwę, aby nowe kształty trafiały do niej, zaznacz wszystkie jej kształty jednym kliknięciem i przenoś kształty między warstwami we Właściwościach.',
      ],
      uk: [
        'Кошик біля кожної фігури, рельєфу й траєкторії в дереві проєкту.',
        'Перетягуйте траєкторії в дереві проєкту, щоб змінити порядок їх виконання. Номери в назвах оновлюються.',
        'Шари: створюйте нові шари, перейменовуйте їх (подвійний клік), робіть шар активним, щоб нові фігури потрапляли туди, виділяйте всі його фігури одним клацанням і переміщуйте фігури між шарами у Властивостях.',
      ],
    },
  },
  {
    version: '0.15.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Text i sju konturtypsnitt (t.ex. romersk inskrift, smal versal, slab serif och skrivstil) – eller läs in ett eget TTF/OTF-typsnitt. Bokstäverna blir slutna konturer för V-gravyr, ficka och inlägg.',
        'Formbibliotek med ramar, banderoller, ornament och mönster (vågor, höjdkurvor, bikakor, hålrad). Välj bearbetning efter att motivet lagts in.',
        'Rundtur för nybörjare med animerade bilder – startar första gången och finns under ?-knappen i sidhuvudet.',
      ],
      en: [
        'Text in seven outline fonts (e.g. Roman inscription, condensed caps, slab serif and script) – or load your own TTF/OTF font. The letters become closed outlines for V-carving, pockets and inlays.',
        'Shape library with frames, banners, ornaments and patterns (waves, contour lines, honeycomb, rows of holes). Choose the machining after adding the motif.',
        'Beginner tour with animated pictures – starts the first time and is available under the ? button in the header.',
      ],
      fr: [
        'Texte en sept polices contour (inscription romaine, capitales étroites, égyptienne, manuscrite…) – ou chargez votre propre police TTF/OTF. Les lettres deviennent des contours fermés pour la gravure en V, les poches et les incrustations.',
        'Bibliothèque de formes : cadres, bannières, ornements et motifs (vagues, courbes de niveau, nid d’abeille, rangées de trous). Choisissez l’usinage après l’ajout.',
        'Visite guidée pour débutants avec images animées – démarre la première fois et reste disponible sous le bouton ? de l’en-tête.',
      ],
      de: [
        'Text in sieben Konturschriften (z. B. römische Inschrift, schmale Versalien, Slab Serif und Schreibschrift) – oder eine eigene TTF/OTF-Schrift laden. Die Buchstaben werden geschlossene Konturen für V-Gravur, Taschen und Intarsien.',
        'Formenbibliothek mit Rahmen, Bannern, Ornamenten und Mustern (Wellen, Höhenlinien, Bienenwaben, Lochreihen). Die Bearbeitung nach dem Einfügen wählen.',
        'Einsteiger-Tour mit animierten Bildern – startet beim ersten Mal und ist unter dem ?-Knopf in der Kopfzeile verfügbar.',
      ],
      es: [
        'Texto en siete fuentes de contorno (p. ej. inscripción romana, mayúsculas estrechas, slab serif y manuscrita), o carga tu propia fuente TTF/OTF. Las letras se convierten en contornos cerrados para grabado en V, vaciados e incrustaciones.',
        'Biblioteca de formas con marcos, banderolas, ornamentos y patrones (olas, curvas de nivel, panal, filas de agujeros). Elige el mecanizado después de añadir el motivo.',
        'Recorrido para principiantes con imágenes animadas: se inicia la primera vez y está en el botón ? de la cabecera.',
      ],
      pl: [
        'Tekst w siedmiu czcionkach konturowych (np. inskrypcja rzymska, wąskie wersaliki, slab serif i pisana) – lub wczytaj własną czcionkę TTF/OTF. Litery stają się zamkniętymi konturami do grawerowania V, kieszeni i intarsji.',
        'Biblioteka kształtów z ramkami, banerami, ornamentami i wzorami (fale, poziomice, plaster miodu, rzędy otworów). Obróbkę wybierasz po dodaniu motywu.',
        'Przewodnik dla początkujących z animowanymi obrazkami – uruchamia się za pierwszym razem i jest pod przyciskiem ? w nagłówku.',
      ],
      uk: [
        'Текст сімома контурними шрифтами (напр. римський напис, вузькі великі, брусковий і рукописний) – або завантажте власний шрифт TTF/OTF. Літери стають замкненими контурами для V-гравіювання, кишень та інкрустацій. Кирилиця – у п’яти з них.',
        'Бібліотека фігур із рамками, банерами, орнаментами й візерунками (хвилі, горизонталі, стільники, ряди отворів). Обробку обираєте після додавання мотиву.',
        'Тур для новачків з анімованими зображеннями – запускається першого разу й доступний під кнопкою ? у заголовку.',
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Fem nya språk: franska, tyska, spanska, polska och ukrainska. Välj språk i sidhuvudet – första gången väljs webbläsarens språk.',
        'Tal visas med decimaltecknet för valt språk.',
        'Gravyrtypsnittet ritar bokstäver med accent som grundbokstaven (É → E, Ñ → N, Ł → L) i stället för ett frågetecken.',
      ],
      en: [
        'Five new languages: French, German, Spanish, Polish and Ukrainian. Choose the language in the header – the first time, the browser’s language is used.',
        'Numbers use the decimal separator of the chosen language.',
        'The engraving font draws accented letters as their base letter (É → E, Ñ → N, Ł → L) instead of a question mark.',
      ],
      fr: [
        'Cinq nouvelles langues : français, allemand, espagnol, polonais et ukrainien. Choisissez la langue dans l’en-tête – la première fois, la langue du navigateur est utilisée.',
        'Les nombres utilisent le séparateur décimal de la langue choisie.',
        'La police de gravure trace les lettres accentuées comme leur lettre de base (É → E, Ñ → N, Ł → L) au lieu d’un point d’interrogation.',
      ],
      de: [
        'Fünf neue Sprachen: Französisch, Deutsch, Spanisch, Polnisch und Ukrainisch. Wählen Sie die Sprache in der Kopfzeile – beim ersten Start gilt die Sprache des Browsers.',
        'Zahlen verwenden das Dezimaltrennzeichen der gewählten Sprache.',
        'Die Gravurschrift zeichnet Buchstaben mit Akzent als Grundbuchstaben (É → E, Ñ → N, Ł → L) statt als Fragezeichen.',
      ],
      es: [
        'Cinco idiomas nuevos: francés, alemán, español, polaco y ucraniano. Elige el idioma en la cabecera; la primera vez se usa el idioma del navegador.',
        'Los números usan el separador decimal del idioma elegido.',
        'La fuente de grabado dibuja las letras acentuadas como su letra base (É → E, Ñ → N, Ł → L) en lugar de un signo de interrogación.',
      ],
      pl: [
        'Pięć nowych języków: francuski, niemiecki, hiszpański, polski i ukraiński. Wybierz język w nagłówku – za pierwszym razem używany jest język przeglądarki.',
        'Liczby używają separatora dziesiętnego wybranego języka.',
        'Czcionka do grawerowania rysuje litery z akcentem jako literę podstawową (É → E, Ñ → N, Ł → L) zamiast znaku zapytania.',
      ],
      uk: [
        'П’ять нових мов: французька, німецька, іспанська, польська та українська. Оберіть мову в заголовку – під час першого запуску використовується мова браузера.',
        'Числа відображаються з десятковим роздільником обраної мови.',
        'Шрифт для гравіювання малює літери з діакритикою як базову літеру (É → E, Ñ → N, Ł → L) замість знака питання. Кирилиця в шрифті поки не підтримується.',
      ],
    },
  },
  {
    version: '0.13.1',
    date: '2026-11-11',
    text: {
      sv: ['Rättat: varje bana visar bara verktyg som fungerar för den. Ficka med V-fräs eller borr gav rester mellan varven – V-fräs finns nu bara för V-gravyr, inlägg, 3D-relief och profil på linjen. Ett redan valt olämpligt verktyg markeras och förklaras.'],
      en: ['Fixed: each toolpath only lists tools that work for it. A pocket with a V-bit or drill left material between the rings – the V-bit is now only offered for V-carving, inlays, 3D relief and profile on the line. An unsuitable tool that is already chosen is marked and explained.'],
      fr: ['Corrigé : chaque parcours ne propose que les outils qui lui conviennent. Une poche avec une fraise en V ou un foret laissait de la matière entre les passes – la fraise en V n’est plus proposée que pour la gravure en V, l’incrustation, le relief 3D et le profil sur la ligne. Un outil inadapté déjà choisi est signalé et expliqué.'],
      de: ['Behoben: Jede Bahn bietet nur Werkzeuge an, die dafür funktionieren. Eine Tasche mit V-Fräser oder Bohrer ließ Material zwischen den Bahnen stehen – der V-Fräser wird jetzt nur noch für V-Gravur, Intarsien, 3D-Relief und Kontur auf der Linie angeboten. Ein bereits gewähltes ungeeignetes Werkzeug wird markiert und erklärt.'],
      es: ['Corregido: cada trayectoria solo ofrece las herramientas que sirven para ella. Un vaciado con fresa en V o broca dejaba material entre las pasadas; la fresa en V ahora solo se ofrece para grabado en V, incrustaciones, relieve 3D y perfil sobre la línea. Una herramienta inadecuada ya elegida se marca y se explica.'],
      pl: ['Poprawiono: każda ścieżka pokazuje tylko narzędzia, które do niej pasują. Kieszeń frezem V lub wiertłem zostawiała materiał między przejściami – frez V jest teraz dostępny tylko dla grawerowania V, intarsji, reliefu 3D i konturu na linii. Już wybrane nieodpowiednie narzędzie jest oznaczone i wyjaśnione.'],
      uk: ['Виправлено: кожна траєкторія пропонує лише інструменти, які для неї підходять. Кишеня V-фрезою чи свердлом залишала матеріал між проходами – V-фреза тепер доступна лише для V-гравіювання, інкрустацій, 3D-рельєфу та контуру по лінії. Уже вибраний невідповідний інструмент позначається й пояснюється.'],
    },
  },
  {
    version: '0.13.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Tipsen anpassas efter maskinen: materialtips för fräs eller laser, och egna tips för lätta fräsar, styva fräsar, svagare och kraftigare lasrar.',
        'Maskinlistan delas upp i fräsar, lasrar och egna profiler med en linje emellan.',
        'Rättat: kanterna såg trappstegsformade ut i simuleringen – väggarna kantutjämnas nu. Själva G-koden var redan rätt.',
        'Bara en knapp för mörkt läge (i sidhuvudet).',
      ],
      en: [
        'Tips follow the machine: material tips for router or laser, and separate tips for light routers, rigid routers, lower- and higher-power lasers.',
        'The machine list is split into routers, lasers and custom profiles with a line between them.',
        'Fixed: edges looked stepped in the simulation – walls are now anti-aliased. The G-code itself was already correct.',
        'Only one dark mode button (in the header).',
      ],
      fr: [
        'Les conseils suivent la machine : conseils matière pour fraiseuse ou laser, et conseils propres aux fraiseuses légères, fraiseuses rigides, lasers faibles et puissants.',
        'La liste des machines est divisée en fraiseuses, lasers et profils personnalisés, séparés par une ligne.',
        'Corrigé : les bords paraissaient en escalier dans la simulation – les parois sont maintenant lissées. Le G-code lui-même était déjà correct.',
        'Un seul bouton pour le mode sombre (dans l’en-tête).',
      ],
      de: [
        'Die Tipps passen sich der Maschine an: Materialtipps für Fräse oder Laser sowie eigene Tipps für leichte Fräsen, steife Fräsen, schwächere und stärkere Laser.',
        'Die Maschinenliste ist in Fräsen, Laser und eigene Profile aufgeteilt, mit einer Linie dazwischen.',
        'Behoben: Kanten sahen in der Simulation treppenförmig aus – Wände werden jetzt geglättet. Der G-Code selbst war bereits korrekt.',
        'Nur noch ein Knopf für den Dunkelmodus (in der Kopfzeile).',
      ],
      es: [
        'Los consejos se adaptan a la máquina: consejos de material para fresadora o láser, y consejos propios para fresadoras ligeras, fresadoras rígidas y láseres de menor y mayor potencia.',
        'La lista de máquinas se divide en fresadoras, láseres y perfiles propios, con una línea entre ellos.',
        'Corregido: los bordes se veían escalonados en la simulación; ahora las paredes se suavizan. El G-code ya era correcto.',
        'Solo un botón para el modo oscuro (en la cabecera).',
      ],
      pl: [
        'Wskazówki dopasowują się do maszyny: wskazówki materiałowe dla frezarki lub lasera oraz osobne wskazówki dla lekkich i sztywnych frezarek oraz słabszych i mocniejszych laserów.',
        'Lista maszyn jest podzielona na frezarki, lasery i własne profile, rozdzielone linią.',
        'Poprawiono: krawędzie w symulacji wyglądały schodkowo – ściany są teraz wygładzane. Sam G-code był już poprawny.',
        'Tylko jeden przycisk trybu ciemnego (w nagłówku).',
      ],
      uk: [
        'Поради залежать від машини: поради щодо матеріалу для фрезера чи лазера та окремі поради для легких і жорстких фрезерів, слабших і потужніших лазерів.',
        'Список машин поділено на фрезери, лазери та власні профілі з лінією між ними.',
        'Виправлено: краї в симуляції мали вигляд сходинок – тепер стінки згладжуються. Сам G-код уже був правильним.',
        'Лише одна кнопка темного режиму (у заголовку).',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-11-11',
    text: {
      sv: ['Cirkulärt mönster: ange cirkelns diameter eller radie och en startvinkel. Originalet flyttas ut på cirkeln och kopiorna fördelas därifrån.'],
      en: ['Circular pattern: enter the circle’s diameter or radius and a start angle. The original is moved onto the circle and the copies are spread from there.'],
      fr: ['Motif circulaire : saisissez le diamètre ou le rayon du cercle et un angle de départ. L’original est placé sur le cercle et les copies sont réparties à partir de là.'],
      de: ['Kreismuster: Durchmesser oder Radius des Kreises und einen Startwinkel eingeben. Das Original wird auf den Kreis verschoben und die Kopien von dort aus verteilt.'],
      es: ['Patrón circular: introduce el diámetro o el radio del círculo y un ángulo inicial. El original se mueve al círculo y las copias se reparten desde ahí.'],
      pl: ['Szyk kołowy: podaj średnicę lub promień okręgu i kąt początkowy. Oryginał jest przesuwany na okrąg, a kopie rozmieszczane od tego miejsca.'],
      uk: ['Круговий масив: вкажіть діаметр або радіус кола та початковий кут. Оригінал переміщується на коло, а копії розподіляються звідти.'],
    },
  },
  {
    version: '0.11.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Mönster: kopiera markeringen linjärt (rader och kolumner) eller cirkulärt runt en mittpunkt – t.ex. hål på en bultcirkel.',
        'Nybörjarläget döljer finjusteringar där standardvärdet nästan alltid är rätt (t.ex. spindelvarvtal, strategidetaljer, postprocessor). Stäng av det för att se allt.',
        'Bilder och små animeringar i inforutorna för alla knappar, och nya inforutor för vyns verktygsrad och knapparna under Egenskaper.',
        'Rättat: cirklar visades som "Öppen linje" under Egenskaper.',
      ],
      en: [
        'Pattern: copy the selection linearly (rows and columns) or circularly around a centre point – e.g. holes on a bolt circle.',
        'Beginner mode hides fine-tuning where the default is almost always right (e.g. spindle speed, strategy details, post-processor). Turn it off to see everything.',
        'Pictures and small animations in the info boxes for all buttons, and new info boxes for the view toolbar and the buttons in Properties.',
        'Fixed: circles were shown as "Open line" in Properties.',
      ],
      fr: [
        'Motif : copiez la sélection de façon linéaire (lignes et colonnes) ou circulaire autour d’un centre – par ex. des trous sur un cercle de perçage.',
        'Le mode débutant masque les réglages fins dont la valeur par défaut est presque toujours bonne (vitesse de broche, détails de stratégie, post-processeur). Désactivez-le pour tout voir.',
        'Images et petites animations dans les bulles d’aide de tous les boutons, et nouvelles bulles pour la barre d’outils de la vue et les boutons des Propriétés.',
        'Corrigé : les cercles étaient affichés comme « Ligne ouverte » dans les Propriétés.',
      ],
      de: [
        'Muster: die Auswahl linear (Zeilen und Spalten) oder kreisförmig um einen Mittelpunkt kopieren – z. B. Bohrungen auf einem Lochkreis.',
        'Der Einsteigermodus blendet Feineinstellungen aus, deren Standardwert fast immer passt (z. B. Spindeldrehzahl, Strategiedetails, Postprozessor). Ausschalten, um alles zu sehen.',
        'Bilder und kleine Animationen in den Infoboxen aller Knöpfe sowie neue Infoboxen für die Werkzeugleiste der Ansicht und die Knöpfe unter Eigenschaften.',
        'Behoben: Kreise wurden unter Eigenschaften als „Offene Linie“ angezeigt.',
      ],
      es: [
        'Patrón: copia la selección de forma lineal (filas y columnas) o circular alrededor de un centro, p. ej. agujeros en un círculo de pernos.',
        'El modo principiante oculta los ajustes finos cuyo valor por defecto casi siempre es correcto (velocidad del husillo, detalles de estrategia, posprocesador). Desactívalo para verlo todo.',
        'Imágenes y pequeñas animaciones en los recuadros de ayuda de todos los botones, y nuevos recuadros para la barra de la vista y los botones de Propiedades.',
        'Corregido: los círculos aparecían como «Línea abierta» en Propiedades.',
      ],
      pl: [
        'Szyk: kopiuj zaznaczenie liniowo (wiersze i kolumny) lub kołowo wokół punktu środkowego – np. otwory na okręgu podziałowym.',
        'Tryb początkującego ukrywa ustawienia, których wartość domyślna prawie zawsze jest dobra (np. obroty wrzeciona, szczegóły strategii, postprocesor). Wyłącz go, aby zobaczyć wszystko.',
        'Obrazki i małe animacje w dymkach wszystkich przycisków oraz nowe dymki dla paska narzędzi widoku i przycisków we Właściwościach.',
        'Poprawiono: okręgi były pokazywane jako „Linia otwarta” we Właściwościach.',
      ],
      uk: [
        'Масив: копіюйте виділення лінійно (рядки й стовпці) або по колу навколо центру – наприклад, отвори на колі болтів.',
        'Режим новачка приховує тонкі налаштування, де значення за замовчуванням майже завжди правильне (оберти шпинделя, деталі стратегії, постпроцесор). Вимкніть його, щоб бачити все.',
        'Зображення та невеликі анімації в підказках усіх кнопок і нові підказки для панелі інструментів виду та кнопок у Властивостях.',
        'Виправлено: кола показувалися як «Відкрита лінія» у Властивостях.',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Mått mellan former kan gå från en sida eller ett hörn – t.ex. ett hål måttsatt från plattans kanter. Välj punkterna i 3 × 3-rutorna.',
        'Versionsnummer i appen och den här listan med nyheter.',
      ],
      en: [
        'Distances between shapes can start at a side or corner – e.g. a hole dimensioned from the edges of a plate. Pick the points in the 3 × 3 grids.',
        'Version number in the app and this list of what is new.',
      ],
      fr: [
        'Les distances entre formes peuvent partir d’un côté ou d’un coin – par ex. un trou coté depuis les bords d’une plaque. Choisissez les points dans les grilles 3 × 3.',
        'Numéro de version dans l’application et cette liste des nouveautés.',
      ],
      de: [
        'Abstände zwischen Formen können von einer Seite oder Ecke ausgehen – z. B. eine Bohrung, bemaßt von den Kanten einer Platte. Punkte in den 3 × 3-Rastern wählen.',
        'Versionsnummer in der App und diese Liste der Neuerungen.',
      ],
      es: [
        'Las distancias entre formas pueden partir de un lado o una esquina, p. ej. un agujero acotado desde los bordes de una placa. Elige los puntos en las cuadrículas de 3 × 3.',
        'Número de versión en la aplicación y esta lista de novedades.',
      ],
      pl: [
        'Odległości między kształtami mogą zaczynać się od boku lub narożnika – np. otwór zwymiarowany od krawędzi płyty. Wybierz punkty w siatkach 3 × 3.',
        'Numer wersji w aplikacji i ta lista nowości.',
      ],
      uk: [
        'Відстані між фігурами можна вимірювати від сторони чи кута – наприклад, отвір, прив’язаний до країв пластини. Оберіть точки в сітках 3 × 3.',
        'Номер версії в застосунку та цей список нововведень.',
      ],
    },
  },
  {
    version: '0.9.0',
    date: '2026-11-11',
    text: {
      sv: ['Reliefinlägg: skapa en plugg som passar i en relief, med limspalt, marginal och hänsyn till fräsens radie.'],
      en: ['Relief inlays: create a plug that fits a relief, with glue gap, margin and allowance for the cutter radius.'],
      fr: ['Incrustation de relief : créez un bouchon qui s’emboîte dans un relief, avec jeu de colle, marge et prise en compte du rayon de la fraise.'],
      de: ['Relief-Intarsien: einen Einleger erzeugen, der in ein Relief passt, mit Klebespalt, Rand und Berücksichtigung des Fräserradius.'],
      es: ['Incrustación de relieve: crea un tapón que encaja en un relieve, con holgura para cola, margen y compensación del radio de la fresa.'],
      pl: ['Intarsja reliefu: utwórz wkładkę pasującą do reliefu, ze szczeliną na klej, marginesem i uwzględnieniem promienia frezu.'],
      uk: ['Інкрустація рельєфу: створіть вставку, що пасує до рельєфу, із зазором для клею, полем і врахуванням радіуса фрези.'],
    },
  },
  {
    version: '0.8.0',
    date: '2026-11-11',
    text: {
      sv: [
        'Bild till relief: logotyper, teckningar, höjdkartor och foton känns igen automatiskt.',
        'Beskär, vrid (−180° till 180°), ta bort bakgrund och gör svartvit vid import – t.ex. ett mobilfoto av en ritning på papper.',
        'Reliefer kan markeras och flyttas direkt i vyn.',
      ],
      en: [
        'Image to relief: logos, drawings, height maps and photos are detected automatically.',
        'Crop, rotate (−180° to 180°), remove background and make black and white on import – e.g. a phone photo of a drawing on paper.',
        'Reliefs can be selected and moved directly in the view.',
      ],
      fr: [
        'Image en relief : logos, dessins, cartes de hauteur et photos sont reconnus automatiquement.',
        'Recadrer, pivoter (−180° à 180°), supprimer le fond et passer en noir et blanc à l’import – par ex. une photo de téléphone d’un dessin sur papier.',
        'Les reliefs peuvent être sélectionnés et déplacés directement dans la vue.',
      ],
      de: [
        'Bild zu Relief: Logos, Zeichnungen, Höhenkarten und Fotos werden automatisch erkannt.',
        'Beim Import zuschneiden, drehen (−180° bis 180°), Hintergrund entfernen und schwarz-weiß machen – z. B. ein Handyfoto einer Zeichnung auf Papier.',
        'Reliefs können direkt in der Ansicht ausgewählt und verschoben werden.',
      ],
      es: [
        'Imagen a relieve: logotipos, dibujos, mapas de altura y fotos se detectan automáticamente.',
        'Recorta, gira (−180° a 180°), elimina el fondo y pasa a blanco y negro al importar, p. ej. una foto con el móvil de un dibujo en papel.',
        'Los relieves se pueden seleccionar y mover directamente en la vista.',
      ],
      pl: [
        'Obraz na relief: logo, rysunki, mapy wysokości i zdjęcia są rozpoznawane automatycznie.',
        'Przytnij, obróć (−180° do 180°), usuń tło i zamień na czarno-białe przy imporcie – np. zdjęcie telefonem rysunku na papierze.',
        'Reliefy można zaznaczać i przesuwać bezpośrednio w widoku.',
      ],
      uk: [
        'Зображення в рельєф: логотипи, малюнки, карти висот і фото розпізнаються автоматично.',
        'Обрізайте, обертайте (−180° до 180°), видаляйте фон і робіть чорно-білим під час імпорту – наприклад, фото з телефона малюнка на папері.',
        'Рельєфи можна виділяти й переміщувати безпосередньо у виді.',
      ],
    },
  },
  {
    version: '0.7.0',
    date: '2026-11-11',
    text: {
      sv: ['Strategier för fickor: konturparallellt eller raster, finpass på väggar och botten, spiral- eller rampnedgång.'],
      en: ['Pocket strategies: offset or raster, finishing pass on walls and floor, helix or ramp entry.'],
      fr: ['Stratégies de poche : contour parallèle ou balayage, passe de finition sur les parois et le fond, entrée en hélice ou en rampe.'],
      de: ['Taschenstrategien: konturparallel oder Zeilen, Schlichtgang an Wänden und Boden, Helix- oder Rampeneintauchen.'],
      es: ['Estrategias de vaciado: offset o barrido, pasada de acabado en paredes y fondo, entrada en hélice o rampa.'],
      pl: ['Strategie kieszeni: równoległa do konturu lub rastrowa, przejście wykańczające ścian i dna, wejście po helisie lub rampie.'],
      uk: ['Стратегії кишень: еквідистантна або растрова, чистовий прохід стінок і дна, вхід по спіралі чи рампі.'],
    },
  },
  {
    version: '0.6.0',
    date: '2026-11-10',
    text: {
      sv: [
        'Linjer fäster vågrätt och lodrätt, och längd och vinkel kan skrivas direkt med tangentbordet.',
        'Hörnradie på alla hörn eller ett i taget (verktyget Radie).',
        'Mått mellan former och verktyget Mått.',
        'Bara former med yta kan fickfräsas, borras eller få radie.',
      ],
      en: [
        'Lines snap horizontal and vertical, and length and angle can be typed directly.',
        'Corner radius on all corners or one at a time (Radius tool).',
        'Distances between shapes and the Measure tool.',
        'Only shapes with an area can be pocketed, drilled or given a radius.',
      ],
      fr: [
        'Les lignes s’accrochent à l’horizontale et à la verticale, et la longueur et l’angle se saisissent directement au clavier.',
        'Rayon d’angle sur tous les coins ou un à la fois (outil Rayon).',
        'Distances entre formes et outil Mesure.',
        'Seules les formes ayant une surface peuvent être évidées, percées ou arrondies.',
      ],
      de: [
        'Linien rasten waagerecht und senkrecht ein, Länge und Winkel lassen sich direkt eintippen.',
        'Eckenradius an allen Ecken oder einzeln (Werkzeug Radius).',
        'Abstände zwischen Formen und das Werkzeug Messen.',
        'Nur Formen mit einer Fläche können als Tasche gefräst, gebohrt oder verrundet werden.',
      ],
      es: [
        'Las líneas se ajustan en horizontal y vertical, y la longitud y el ángulo se pueden escribir directamente.',
        'Radio de esquina en todas las esquinas o de una en una (herramienta Radio).',
        'Distancias entre formas y la herramienta Medir.',
        'Solo las formas con área se pueden vaciar, taladrar o redondear.',
      ],
      pl: [
        'Linie przyciągają się poziomo i pionowo, a długość i kąt można wpisać bezpośrednio z klawiatury.',
        'Promień naroża na wszystkich narożach lub pojedynczo (narzędzie Promień).',
        'Odległości między kształtami i narzędzie Pomiar.',
        'Tylko kształty z polem powierzchni można frezować jako kieszeń, wiercić lub zaokrąglać.',
      ],
      uk: [
        'Лінії прив’язуються горизонтально й вертикально, а довжину й кут можна вводити з клавіатури.',
        'Радіус кута на всіх кутах або на одному (інструмент Радіус).',
        'Відстані між фігурами та інструмент Вимір.',
        'Лише фігури з площею можна фрезерувати як кишеню, свердлити чи заокруглювати.',
      ],
    },
  },
  {
    version: '0.5.0',
    date: '2026-11-10',
    text: {
      sv: ['Placera flikar själv i vyn, som i Estlcam. Rättat: finpasset fräste bort flikarna.'],
      en: ['Place tabs yourself in the view, like Estlcam. Fixed: the finishing pass cut away the tabs.'],
      fr: ['Placez vous-même les attaches dans la vue, comme dans Estlcam. Corrigé : la passe de finition coupait les attaches.'],
      de: ['Haltestege selbst in der Ansicht setzen, wie in Estlcam. Behoben: Der Schlichtgang fräste die Haltestege weg.'],
      es: ['Coloca tú mismo las pestañas en la vista, como en Estlcam. Corregido: la pasada de acabado cortaba las pestañas.'],
      pl: ['Umieszczaj mostki samodzielnie w widoku, jak w Estlcam. Poprawiono: przejście wykańczające wycinało mostki.'],
      uk: ['Розміщуйте перемички самі у виді, як в Estlcam. Виправлено: чистовий прохід вирізав перемички.'],
    },
  },
  {
    version: '0.4.0',
    date: '2026-11-10',
    text: {
      sv: ['Strategier för profilfräsning (grov- och finpass, ramp), flikar och egna maskinprofiler.'],
      en: ['Profile strategies (roughing and finishing, ramp), tabs and custom machine profiles.'],
      fr: ['Stratégies de contournage (ébauche et finition, rampe), attaches et profils machine personnalisés.'],
      de: ['Konturstrategien (Schruppen und Schlichten, Rampe), Haltestege und eigene Maschinenprofile.'],
      es: ['Estrategias de perfilado (desbaste y acabado, rampa), pestañas y perfiles de máquina propios.'],
      pl: ['Strategie frezowania konturu (zgrubne i wykańczające, rampa), mostki i własne profile maszyn.'],
      uk: ['Стратегії контурного фрезерування (чорнова й чистова обробка, рампа), перемички та власні профілі машин.'],
    },
  },
  {
    version: '0.3.0',
    date: '2026-11-10',
    text: {
      sv: ['Verktygsbibliotek med bilder, mått, antal skär och längder. Varning om verktyget inte når eller spännhylsan slår i.'],
      en: ['Tool library with pictures, dimensions, flutes and lengths. Warning if the tool cannot reach or the collet would hit.'],
      fr: ['Bibliothèque d’outils avec images, dimensions, nombre de dents et longueurs. Avertissement si l’outil n’atteint pas la profondeur ou si la pince touche.'],
      de: ['Werkzeugbibliothek mit Bildern, Maßen, Schneidenzahl und Längen. Warnung, wenn das Werkzeug nicht hinreicht oder die Spannzange anstößt.'],
      es: ['Biblioteca de herramientas con imágenes, medidas, número de filos y longitudes. Aviso si la herramienta no llega o la pinza choca.'],
      pl: ['Biblioteka narzędzi z obrazkami, wymiarami, liczbą ostrzy i długościami. Ostrzeżenie, gdy narzędzie nie sięga lub tulejka uderzy.'],
      uk: ['Бібліотека інструментів із зображеннями, розмірами, кількістю зубів і довжинами. Попередження, якщо інструмент не дістає або цанга вдариться.'],
    },
  },
  {
    version: '0.2.0',
    date: '2026-11-10',
    text: {
      sv: [
        'Text som kontur (för ficka, V-gravyr och inlägg), kugghjul med valfri kuggform och simulering av fräsningen.',
        'Rättat: ritade objekt hamnade fel på skärmar med skalning.',
      ],
      en: [
        'Outline text (for pocket, V-carve and inlay), gears with a choice of tooth shape and a machining simulation.',
        'Fixed: drawn objects ended up in the wrong place on scaled screens.',
      ],
      fr: [
        'Texte en contour (pour poche, gravure en V et incrustation), engrenages avec choix de la forme des dents et simulation de l’usinage.',
        'Corrigé : les objets dessinés se plaçaient mal sur les écrans mis à l’échelle.',
      ],
      de: [
        'Text als Kontur (für Tasche, V-Gravur und Intarsie), Zahnräder mit wählbarer Zahnform und eine Simulation der Bearbeitung.',
        'Behoben: Gezeichnete Objekte landeten auf skalierten Bildschirmen an der falschen Stelle.',
      ],
      es: [
        'Texto como contorno (para vaciado, grabado en V e incrustación), engranajes con forma de diente a elegir y simulación del mecanizado.',
        'Corregido: los objetos dibujados quedaban en el lugar equivocado en pantallas escaladas.',
      ],
      pl: [
        'Tekst jako kontur (do kieszeni, grawerowania V i intarsji), koła zębate z wyborem kształtu zęba i symulacja obróbki.',
        'Poprawiono: rysowane obiekty trafiały w złe miejsce na skalowanych ekranach.',
      ],
      uk: [
        'Текст як контур (для кишені, V-гравіювання та інкрустації), зубчасті колеса з вибором форми зуба та симуляція обробки.',
        'Виправлено: намальовані об’єкти потрапляли не туди на масштабованих екранах.',
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-11-07',
    text: {
      sv: ['Första versionen: rita och importera SVG/DXF, profil, ficka, borrning, V-gravyr, inlägg, laser, reliefbibliotek och G-kod.'],
      en: ['First version: draw and import SVG/DXF, profile, pocket, drilling, V-carve, inlay, laser, relief library and G-code.'],
      fr: ['Première version : dessin et import SVG/DXF, contournage, poche, perçage, gravure en V, incrustation, laser, bibliothèque de reliefs et G-code.'],
      de: ['Erste Version: Zeichnen und SVG/DXF-Import, Kontur, Tasche, Bohren, V-Gravur, Intarsie, Laser, Reliefbibliothek und G-Code.'],
      es: ['Primera versión: dibujo e importación SVG/DXF, perfil, vaciado, taladrado, grabado en V, incrustación, láser, biblioteca de relieves y G-code.'],
      pl: ['Pierwsza wersja: rysowanie i import SVG/DXF, kontur, kieszeń, wiercenie, grawerowanie V, intarsja, laser, biblioteka reliefów i G-code.'],
      uk: ['Перша версія: малювання та імпорт SVG/DXF, контур, кишеня, свердління, V-гравіювання, інкрустація, лазер, бібліотека рельєфів і G-код.'],
    },
  },
];

export const APP_VERSION = __APP_VERSION__;
