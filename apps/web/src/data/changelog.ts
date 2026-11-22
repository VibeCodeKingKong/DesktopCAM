/**
 * Versionshistorik som visas i appen (Om desktopCAM → Nyheter).
 * En post per dag: görs en ny version samma dag som den översta posten,
 * uppdateras den posten (versionen och texten, som då täcker hela dagens
 * nyheter) i stället för att en ny läggs till. Höj versionen i
 * apps/web/package.json (och i roten) vid varje uppdatering. Den översta
 * posten ska ha samma version som package.json – det kontrolleras när appen
 * startar i dev-läge.
 *
 * Varje post måste ha text på alla språk i appen – typen kräver det.
 *
 * Skriv för användaren (se CLAUDE.md, "Nyheter"): en punkt per funktion som
 * börjar med en kort rubrik i fetstil, **Rubrik**, följd av vad man kan göra
 * och var det finns. Inga tekniska detaljer.
 */
import type { Language } from '../i18n/initial';

export interface ChangelogEntry {
  version: string;
  date: string;
  text: Record<Language, string[]>;
  /**
   * Versionen där varje punkt tillkom (samma ordning som i text). Behövs när
   * dagens post uppdateras: gamla punkter behåller sin version, nya får den
   * nya. Saknas den gäller postens version för alla punkter.
   */
  since?: string[];
}

/** Jämför versionsnummer (1.2.10 > 1.2.9). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.43.3',
    date: '2026-11-22',
    text: {
      sv: ["**Se detaljer som är för små** När en verktygsbana är beräknad markeras hål, spalter och smala delar som verktyget inte klarar direkt i vyn, med färg och nummer: rött skärs inte, orange blir dåligt och gult kan brännas bort (vid fräsning: brytas av). Under Resultat i egenskaperna står samma nummer med råd för just plasma, laser eller fräs. Klicka på en rad för att zooma dit, eller på en markering för att se raden.", "**Små hål med plasma** Hål som är för små för plasman kan bli ett borrmärke – en kort tändning i mitten som du sedan borrar upp – ett genomstick eller hoppas över. Välj under Hål → Små hål i plasmabanans egenskaper.", "**Gruppera former** Håll ihop delar som hör till samma detalj, till exempel en skylt med text och ram. Markera formerna och välj Design → Gruppera (⌘G). Sedan flyttas, vrids och rätas de upp tillsammans, markeringsramen vrids med – och former som du spårat från ett foto tar med sig fotot. Med Dela upp blir de fristående igen.", "**Markera flera former** På telefonen trycker du på Markera flera i knappraden längst ner och sedan på formerna, eller drar över en tom yta. På datorn håller du ned Shift och drar en ruta, och ⌘A markerar allt.", "**Kortare vägar med plasma** Plasman tar närmaste detalj i tur och ordning i stället för minsta först, och skär fortfarande hålen i varje detalj före ytterkonturen – i exempelskölden blir förflyttningarna 15 % kortare. Har du flera plasmabanor visas förflyttningarna nu från en bana till nästa, som maskinen kör dem, i stället för tillbaka till nollpunkten emellan, och banan ligger rätt på formen även när du tittar snett på den."],
      en: ["**See details that are too small** Once a toolpath is calculated, holes, slots and narrow parts the tool cannot handle are marked in the view with colour and number: red will not cut, orange gives a poor result and yellow may burn away (when routing: break off). Under Result in the properties, the same numbers are listed with advice for plasma, laser or router. Click a row to zoom there, or a marker to see its row.", "**Small holes with plasma** Holes too small for the plasma can become a drill mark – a short torch fire in the centre that you then drill out – a pierce only, or be skipped. Choose under Holes → Small holes in the plasma toolpath's properties.", "**Group shapes** Keep parts that belong together, such as a sign with text and a frame. Select the shapes and choose Design → Group (⌘G). They are then moved, rotated and straightened together, the selection frame turns with them – and shapes traced from a photo bring the photo along. Ungroup makes them separate again.", "**Select several shapes** On your phone, tap Select several in the button bar at the bottom and then the shapes, or drag over an empty area. On a computer, hold Shift and drag a box, and ⌘A selects everything.", "**Shorter plasma moves** The plasma now takes the nearest part next instead of the smallest first, and still cuts each part's holes before its outline – 15% shorter moves in the shield example. With several plasma toolpaths, the moves are now shown from one toolpath to the next, as the machine runs them, instead of back to the origin in between, and the path sits right on the shape even when viewed at an angle."],
      fr: ["**Voir les détails trop petits** Une fois un parcours calculé, les trous, fentes et parties étroites que l’outil ne peut pas réaliser sont marqués dans la vue avec une couleur et un numéro : rouge ne sera pas découpé, orange donne un mauvais résultat et jaune peut brûler (en fraisage : casser). Sous Résultat dans les propriétés, les mêmes numéros sont listés avec des conseils pour plasma, laser ou fraiseuse. Cliquez sur une ligne pour y zoomer, ou sur un repère pour voir sa ligne.", "**Petits trous au plasma** Les trous trop petits pour le plasma peuvent devenir une marque de perçage – un bref allumage au centre que vous percez ensuite –, un simple perçage de la tôle, ou être ignorés. Choisissez dans Trous → Petits trous des propriétés du parcours plasma.", "**Grouper des formes** Gardez ensemble les pièces qui vont ensemble, par exemple un panneau avec texte et cadre. Sélectionnez les formes et choisissez Dessin → Grouper (⌘G). Elles sont ensuite déplacées, pivotées et redressées ensemble, le cadre de sélection tourne avec elles – et les formes tracées d’après une photo emportent la photo. Dissocier les sépare à nouveau.", "**Sélectionner plusieurs formes** Sur téléphone, appuyez sur Sélection multiple dans la barre du bas puis sur les formes, ou glissez sur une zone vide. Sur ordinateur, maintenez Maj et tracez un cadre ; ⌘A sélectionne tout.", "**Déplacements plus courts au plasma** Le plasma passe à la pièce la plus proche au lieu de la plus petite, et découpe toujours les trous de chaque pièce avant son contour – 15 % de déplacements en moins sur l’exemple du bouclier. Avec plusieurs parcours plasma, les déplacements sont maintenant affichés d’un parcours au suivant, comme la machine les exécute, au lieu de revenir à l’origine entre les deux, et le parcours reste bien sur la forme même vu en biais."],
      de: ["**Zu kleine Details erkennen** Ist eine Bahn berechnet, werden Löcher, Schlitze und schmale Teile, die das Werkzeug nicht schafft, in der Ansicht mit Farbe und Nummer markiert: Rot wird nicht geschnitten, Orange wird schlecht, Gelb kann wegbrennen (beim Fräsen: abbrechen). Unter Ergebnis in den Eigenschaften stehen dieselben Nummern mit Tipps für Plasma, Laser oder Fräse. Klicken Sie auf eine Zeile, um dorthin zu zoomen, oder auf eine Markierung, um ihre Zeile zu sehen.", "**Kleine Löcher mit Plasma** Löcher, die für das Plasma zu klein sind, können eine Bohrmarke werden – ein kurzes Zünden in der Mitte, das Sie danach aufbohren –, nur einen Einstich bekommen oder übersprungen werden. Auswahl unter Löcher → Kleine Löcher in den Eigenschaften der Plasmabahn.", "**Formen gruppieren** Halten Sie Teile zusammen, die zusammengehören, etwa ein Schild mit Text und Rahmen. Formen auswählen und Design → Gruppieren (⌘G) wählen. Danach werden sie gemeinsam verschoben, gedreht und ausgerichtet, der Auswahlrahmen dreht sich mit – und von einem Foto nachgezeichnete Formen nehmen das Foto mit. Aufheben trennt sie wieder.", "**Mehrere Formen auswählen** Auf dem Handy unten auf Mehrfachauswahl tippen und dann auf die Formen, oder über eine leere Fläche ziehen. Am Computer Umschalt halten und einen Rahmen ziehen; ⌘A wählt alles aus.", "**Kürzere Wege beim Plasma** Das Plasma nimmt jetzt das nächstgelegene Teil statt des kleinsten zuerst und schneidet weiterhin die Löcher jedes Teils vor seiner Außenkontur – im Schild-Beispiel 15 % kürzere Leerfahrten. Bei mehreren Plasmabahnen werden die Leerfahrten jetzt von einer Bahn zur nächsten gezeigt, wie die Maschine sie fährt, statt zwischendurch zum Nullpunkt, und die Bahn liegt auch bei schräger Ansicht genau auf der Form."],
      es: ["**Ver los detalles demasiado pequeños** Al calcular una trayectoria, los agujeros, ranuras y partes estrechas que la herramienta no puede hacer se marcan en la vista con color y número: rojo no se cortará, naranja quedará mal y amarillo puede quemarse (al fresar: romperse). En Resultado, dentro de las propiedades, aparecen los mismos números con consejos para plasma, láser o fresadora. Haga clic en una fila para acercarse, o en una marca para ver su fila.", "**Agujeros pequeños con plasma** Los agujeros demasiado pequeños para el plasma pueden convertirse en una marca de taladro – un encendido breve en el centro que luego taladra –, solo una perforación, u omitirse. Elija en Agujeros → Agujeros pequeños, en las propiedades de la trayectoria de plasma.", "**Agrupar formas** Mantenga juntas las piezas que van juntas, por ejemplo un cartel con texto y marco. Seleccione las formas y elija Diseño → Agrupar (⌘G). Después se mueven, giran y enderezan juntas, el recuadro de selección gira con ellas y las formas trazadas de una foto se llevan la foto. Desagrupar las separa de nuevo.", "**Seleccionar varias formas** En el móvil, toque Selección múltiple en la barra de abajo y luego las formas, o arrastre sobre un espacio vacío. En el ordenador, mantenga Mayús y arrastre un recuadro; ⌘A selecciona todo.", "**Desplazamientos más cortos con plasma** El plasma pasa a la pieza más cercana en lugar de a la más pequeña, y sigue cortando los agujeros de cada pieza antes de su contorno: un 15 % menos de desplazamientos en el ejemplo del escudo. Con varias trayectorias de plasma, los desplazamientos se muestran ahora de una trayectoria a la siguiente, como los hace la máquina, en lugar de volver al origen entre ellas, y la trayectoria queda justo sobre la forma aunque se mire en ángulo."],
      pl: ["**Zobacz za małe detale** Po obliczeniu ścieżki otwory, szczeliny i wąskie części, z którymi narzędzie sobie nie poradzi, są zaznaczone w widoku kolorem i numerem: czerwony nie zostanie wycięty, pomarańczowy wyjdzie słabo, a żółty może się wypalić (przy frezowaniu: odłamać). W sekcji Wynik we właściwościach są te same numery z poradami dla plazmy, lasera lub frezarki. Kliknij wiersz, aby przybliżyć to miejsce, albo znacznik, aby zobaczyć jego wiersz.", "**Małe otwory przy plazmie** Otwory za małe dla plazmy mogą stać się znacznikiem wiercenia – krótkim zapłonem w środku, który potem rozwiercasz – samym przebiciem albo zostać pominięte. Wybierz w Otwory → Małe otwory we właściwościach ścieżki plazmy.", "**Grupowanie kształtów** Trzymaj razem części, które do siebie należą, np. szyld z tekstem i ramką. Zaznacz kształty i wybierz Projektowanie → Grupuj (⌘G). Odtąd są razem przesuwane, obracane i prostowane, ramka zaznaczenia obraca się razem z nimi – a kształty obrysowane ze zdjęcia zabierają zdjęcie ze sobą. Rozgrupuj znów je rozdziela.", "**Zaznaczanie wielu kształtów** Na telefonie dotknij Zaznacz wiele na dolnym pasku, a potem kształtów, albo przeciągnij po pustym miejscu. Na komputerze przytrzymaj Shift i przeciągnij ramkę; ⌘A zaznacza wszystko.", "**Krótsze przejazdy plazmy** Plazma przechodzi do najbliższej części zamiast do najmniejszej i nadal wycina otwory każdej części przed jej konturem – w przykładzie z tarczą przejazdy są o 15% krótsze. Przy kilku ścieżkach plazmy przejazdy są teraz pokazane od jednej ścieżki do następnej, tak jak wykonuje je maszyna, a nie z powrotem do punktu zerowego pomiędzy nimi, a ścieżka leży dokładnie na kształcie także w widoku pod kątem."],
      uk: ["**Бачте занадто дрібні деталі** Після розрахунку траєкторії отвори, прорізи й вузькі частини, з якими інструмент не впорається, позначаються у вікні кольором і номером: червоне не виріжеться, помаранчеве вийде погано, а жовте може вигоріти (при фрезеруванні – відламатися). У розділі Результат у властивостях ті самі номери з порадами для плазми, лазера чи фрезера. Натисніть рядок, щоб наблизити це місце, або позначку, щоб побачити її рядок.", "**Малі отвори плазмою** Отвори, замалі для плазми, можуть стати міткою для свердління – коротким запалюванням у центрі, яке ви потім розсвердлюєте, – лише пробиванням або бути пропущені. Виберіть у Отвори → Малі отвори у властивостях плазмової траєкторії.", "**Групування фігур** Тримайте разом частини, що належать одна одній, наприклад вивіску з текстом і рамкою. Виділіть фігури й виберіть Дизайн → Групувати (⌘G). Відтак вони переміщуються, повертаються й вирівнюються разом, рамка виділення повертається з ними, а фігури, обведені з фото, забирають фото із собою. Розгрупувати знову їх роз’єднує.", "**Виділення кількох фігур** На телефоні торкніться Виділити кілька на нижній панелі, а потім фігур, або проведіть по порожньому місцю. На комп’ютері утримуйте Shift і тягніть рамку; ⌘A виділяє все.", "**Коротші переходи плазми** Плазма переходить до найближчої деталі, а не до найменшої, і, як і раніше, вирізає отвори кожної деталі перед її контуром – у прикладі зі щитом переходи коротші на 15%. Якщо траєкторій плазми кілька, переходи тепер показано від однієї траєкторії до наступної, як їх виконує верстат, а не назад до нуля між ними, і траєкторія лежить точно на фігурі навіть під кутом огляду."],
    },
    since: ['0.43.0', '0.43.0', '0.42.0', '0.42.0', '0.43.2'],
  },
  {
    version: '0.41.0',
    date: '2026-11-21',
    text: {
      sv: ["**Kortare körtider** Fickor, reliefer, V-gravyr och borrning går klart snabbare med samma resultat – i våra tester sammanlagt nästan en femtedel kortare tid på en hobbyfräs. Fickor och reliefer fräses inte längre i luften, och fräsen lyfter bara strax över materialet mellan närliggande spår.", "**Mer rättvisande tid** Uppskattad tid och simuleringens maskintid räknar nu med hur fort just din maskin kan röra sig, så att du vet hur länge jobbet verkligen tar.", "**Inställning för skruvar och klämmor** Sitter skruvar eller klämmor mellan delarna kan du stänga av det korta lyftet under Maskininställning → Postprocessor."],
      en: ["**Shorter run times** Pockets, reliefs, V-carving and drilling finish noticeably faster with the same result – almost a fifth less time in total on a hobby router in our tests. Pockets and reliefs no longer cut air, and the cutter only lifts just above the material between nearby cuts.", "**More realistic time** The estimated time and the simulation's machine time now use how fast your machine can actually move, so you know how long the job really takes.", "**Setting for screws and clamps** If screws or clamps sit between the parts, you can turn off the short lift under Machine setup → Post processor."],
      fr: ["**Usinage plus court** Poches, reliefs, gravure en V et perçage sont nettement plus rapides avec le même résultat – près d’un cinquième de temps en moins au total sur une fraiseuse de loisir dans nos tests. Poches et reliefs ne fraisent plus dans le vide, et la fraise ne remonte que juste au-dessus du matériau entre passes proches.", "**Temps plus réaliste** Le temps estimé et le temps machine de la simulation tiennent compte de la vitesse réelle de votre machine, pour savoir combien de temps le travail prend vraiment.", "**Réglage pour vis et brides** Si des vis ou brides se trouvent entre les pièces, désactivez la levée courte dans Configuration machine → Post-processeur."],
      de: ["**Kürzere Laufzeiten** Taschen, Reliefs, V-Gravuren und Bohrungen sind bei gleichem Ergebnis deutlich schneller fertig – in unseren Tests insgesamt fast ein Fünftel weniger Zeit auf einer Hobbyfräse. Taschen und Reliefs fräsen nicht mehr in der Luft, und der Fräser hebt zwischen nahen Bahnen nur knapp über das Material.", "**Realistischere Zeit** Geschätzte Zeit und Maschinenzeit der Simulation berücksichtigen, wie schnell Ihre Maschine wirklich fährt – so wissen Sie, wie lange der Auftrag tatsächlich dauert.", "**Einstellung für Schrauben und Spannpratzen** Sitzen Schrauben oder Pratzen zwischen den Teilen, schalten Sie den kurzen Hub unter Maschineneinrichtung → Postprozessor aus."],
      es: ["**Mecanizados más cortos** Cajeras, relieves, grabado en V y taladrado terminan bastante antes con el mismo resultado: casi una quinta parte menos de tiempo en total en una fresadora de aficionado en nuestras pruebas. Las cajeras y los relieves ya no cortan en el aire, y la fresa solo sube justo por encima del material entre cortes cercanos.", "**Tiempo más realista** El tiempo estimado y el tiempo de máquina de la simulación tienen en cuenta lo rápido que se mueve su máquina, para saber cuánto dura de verdad el trabajo.", "**Ajuste para tornillos y mordazas** Si hay tornillos o mordazas entre las piezas, desactive la elevación corta en Configuración de la máquina → Postprocesador."],
      pl: ["**Krótszy czas obróbki** Kieszenie, reliefy, grawerowanie V i wiercenie kończą się wyraźnie szybciej z tym samym efektem – w naszych testach łącznie prawie o jedną piątą krócej na frezarce hobbystycznej. Kieszenie i reliefy nie są już frezowane w powietrzu, a frez między bliskimi ścieżkami unosi się tylko tuż nad materiał.", "**Bardziej realny czas** Szacowany czas i czas maszynowy symulacji uwzględniają, jak szybko naprawdę porusza się Twoja maszyna, więc wiesz, ile praca faktycznie potrwa.", "**Ustawienie dla wkrętów i docisków** Jeśli między częściami są wkręty lub dociski, wyłącz krótki podnos w Ustawienia maszyny → Postprocesor."],
      uk: ["**Коротший час обробки** Кишені, рельєфи, V-гравіювання та свердління завершуються помітно швидше з тим самим результатом – у наших тестах загалом майже на п’яту частину швидше на аматорському верстаті. Кишені й рельєфи більше не фрезеруються в повітрі, а між близькими проходами фреза піднімається лише трохи над матеріалом.", "**Реалістичніший час** Орієнтовний час і машинний час симуляції враховують, як швидко насправді рухається ваш верстат, тож ви знаєте, скільки триватиме робота.", "**Налаштування для гвинтів і притисків** Якщо між деталями є гвинти чи притиски, вимкніть короткий підйом у Налаштування верстата → Постпроцесор."],
    },
  },
  {
    version: '0.40.0',
    date: '2026-11-21',
    text: {
      sv: ["**Senaste projekt** Under Arkiv → Senaste hittar du de 20 senaste projekten och kan öppna dem igen. De sparas automatiskt medan du arbetar.", "**Skuggor försvinner vid spårning** När du spårar ett foto tas gråa skuggor på papperet bort automatiskt, så att konturen följer föremålet. För gråa föremål som aluminium kan du stänga av det.", "**Tydligare banor** Fräsbanorna syns nu tydligt i 3D-vyn, även när de ligger under materialets yta.", "**Felrapporter** Om något går fel får du frågan om du vill skicka en rapport. Du ser exakt vad som skickas – aldrig dina ritningar."],
      en: ["**Recent projects** Under File → Recent you find your 20 latest projects and can open them again. They are saved automatically while you work.", "**Shadows disappear when tracing** When you trace a photo, grey shadows on the paper are removed automatically so the outline follows the object. For grey objects such as aluminium you can turn this off.", "**Clearer toolpaths** Toolpaths are now clearly visible in the 3D view, even below the material surface.", "**Error reports** If something goes wrong you are asked whether to send a report. You see exactly what is sent – never your drawings."],
      fr: ["**Projets récents** Dans Fichier → Récents, retrouvez vos 20 derniers projets et rouvrez-les. Ils sont enregistrés automatiquement pendant que vous travaillez.", "**Les ombres disparaissent au traçage** En traçant une photo, les ombres grises sur le papier sont supprimées automatiquement pour que le contour suive l’objet. Pour les objets gris comme l’aluminium, vous pouvez désactiver cette option.", "**Parcours plus visibles** Les parcours sont maintenant bien visibles dans la vue 3D, même sous la surface du matériau.", "**Rapports d’erreur** En cas de problème, il vous est demandé si vous voulez envoyer un rapport. Vous voyez exactement ce qui est envoyé – jamais vos dessins."],
      de: ["**Zuletzt verwendete Projekte** Unter Datei → Zuletzt finden Sie Ihre 20 letzten Projekte und können sie wieder öffnen. Sie werden beim Arbeiten automatisch gespeichert.", "**Schatten verschwinden beim Nachzeichnen** Beim Nachzeichnen eines Fotos werden graue Schatten auf dem Papier automatisch entfernt, damit die Kontur dem Gegenstand folgt. Für graue Gegenstände wie Aluminium lässt sich das abschalten.", "**Deutlichere Bahnen** Fräsbahnen sind in der 3D-Ansicht jetzt gut zu sehen, auch unter der Materialoberfläche.", "**Fehlerberichte** Wenn etwas schiefgeht, werden Sie gefragt, ob ein Bericht gesendet werden soll. Sie sehen genau, was gesendet wird – nie Ihre Zeichnungen."],
      es: ["**Proyectos recientes** En Archivo → Recientes encontrará sus 20 últimos proyectos y podrá volver a abrirlos. Se guardan automáticamente mientras trabaja.", "**Las sombras desaparecen al trazar** Al trazar una foto, las sombras grises sobre el papel se eliminan automáticamente para que el contorno siga al objeto. Para objetos grises como el aluminio puede desactivarlo.", "**Trayectorias más claras** Las trayectorias se ven ahora claramente en la vista 3D, incluso bajo la superficie del material.", "**Informes de error** Si algo falla, se le pregunta si quiere enviar un informe. Verá exactamente qué se envía: nunca sus dibujos."],
      pl: ["**Ostatnie projekty** W Plik → Ostatnie znajdziesz 20 ostatnich projektów i możesz je ponownie otworzyć. Zapisują się automatycznie podczas pracy.", "**Cienie znikają przy obrysowywaniu** Przy obrysowywaniu zdjęcia szare cienie na papierze są usuwane automatycznie, aby kontur podążał za przedmiotem. Dla szarych przedmiotów, np. z aluminium, możesz to wyłączyć.", "**Wyraźniejsze ścieżki** Ścieżki frezowania są teraz dobrze widoczne w widoku 3D, także pod powierzchnią materiału.", "**Raporty o błędach** Gdy coś pójdzie nie tak, pojawi się pytanie, czy wysłać raport. Widzisz dokładnie, co jest wysyłane – nigdy Twoje rysunki."],
      uk: ["**Останні проєкти** У Файл → Останні ви знайдете 20 останніх проєктів і зможете відкрити їх знову. Вони зберігаються автоматично під час роботи.", "**Тіні зникають під час обведення** Під час обведення фото сірі тіні на папері прибираються автоматично, тож контур повторює предмет. Для сірих предметів, як-от алюміній, це можна вимкнути.", "**Чіткіші траєкторії** Траєкторії фрезування тепер добре видно в 3D-виді, навіть під поверхнею матеріалу.", "**Звіти про помилки** Якщо щось піде не так, вас запитають, чи надіслати звіт. Ви бачите, що саме надсилається – ніколи ваші креслення."],
    },
  },
  {
    version: '0.39.0',
    date: '2026-11-21',
    text: {
      sv: ["**Fungerar utan internet** Efter första besöket fungerar desktopCAM även utan nät – rita, beräkna banor, simulera och spara G-kod ute i verkstaden.", "**Installera som app** Lägg desktopCAM på hemskärmen på telefonen (Dela → Lägg till på hemskärmen) eller installera den via ikonen i adressfältet på datorn.", "**Snabbare start** Appen öppnas fortare, särskilt på mobilnät.", "**Du bestämmer när den uppdateras** Finns en ny version visas en fråga – appen laddar aldrig om mitt i ditt arbete."],
      en: ["**Works without internet** After the first visit desktopCAM also works offline – draw, calculate toolpaths, simulate and save G-code out in the workshop.", "**Install as an app** Put desktopCAM on your phone's home screen (Share → Add to Home Screen) or install it via the icon in the address bar on a computer.", "**Faster start** The app opens faster, especially on mobile networks.", "**You decide when it updates** When a new version is available you are asked – the app never reloads in the middle of your work."],
      fr: ["**Fonctionne sans internet** Après la première visite, desktopCAM fonctionne aussi hors ligne – dessiner, calculer les parcours, simuler et enregistrer le G-code à l’atelier.", "**Installer comme une application** Ajoutez desktopCAM à l’écran d’accueil du téléphone (Partager → Sur l’écran d’accueil) ou installez-le via l’icône de la barre d’adresse sur ordinateur.", "**Démarrage plus rapide** L’application s’ouvre plus vite, surtout sur réseau mobile.", "**Vous choisissez quand mettre à jour** Quand une nouvelle version est disponible, une question s’affiche – l’application ne se recharge jamais en plein travail."],
      de: ["**Funktioniert ohne Internet** Nach dem ersten Besuch funktioniert desktopCAM auch offline – zeichnen, Bahnen berechnen, simulieren und G-Code speichern direkt in der Werkstatt.", "**Als App installieren** Legen Sie desktopCAM auf den Home-Bildschirm des Handys (Teilen → Zum Home-Bildschirm) oder installieren Sie es über das Symbol in der Adressleiste am Computer.", "**Schnellerer Start** Die App öffnet sich schneller, besonders im Mobilfunknetz.", "**Sie entscheiden, wann aktualisiert wird** Gibt es eine neue Version, erscheint eine Frage – die App lädt nie mitten in Ihrer Arbeit neu."],
      es: ["**Funciona sin internet** Tras la primera visita, desktopCAM también funciona sin conexión: dibujar, calcular trayectorias, simular y guardar G-code en el taller.", "**Instalar como app** Añada desktopCAM a la pantalla de inicio del móvil (Compartir → Añadir a pantalla de inicio) o instálelo con el icono de la barra de direcciones en el ordenador.", "**Inicio más rápido** La app se abre antes, sobre todo en redes móviles.", "**Usted decide cuándo actualizar** Cuando hay una versión nueva aparece una pregunta: la app nunca se recarga en mitad de su trabajo."],
      pl: ["**Działa bez internetu** Po pierwszej wizycie desktopCAM działa także offline – rysowanie, obliczanie ścieżek, symulacja i zapis G-code w warsztacie.", "**Instalacja jako aplikacja** Dodaj desktopCAM do ekranu głównego telefonu (Udostępnij → Do ekranu głównego) lub zainstaluj ikoną w pasku adresu na komputerze.", "**Szybszy start** Aplikacja otwiera się szybciej, zwłaszcza w sieci komórkowej.", "**Ty decydujesz o aktualizacji** Gdy jest nowa wersja, pojawia się pytanie – aplikacja nigdy nie przeładowuje się w trakcie pracy."],
      uk: ["**Працює без інтернету** Після першого відвідування desktopCAM працює й офлайн – малюйте, розраховуйте траєкторії, симулюйте й зберігайте G-код просто в майстерні.", "**Встановлення як застосунку** Додайте desktopCAM на головний екран телефона (Поділитися → На головний екран) або встановіть через значок в адресному рядку на комп’ютері.", "**Швидший запуск** Застосунок відкривається швидше, особливо в мобільній мережі.", "**Ви вирішуєте, коли оновлюватися** Коли є нова версія, з’являється запитання – застосунок ніколи не перезавантажується посеред роботи."],
    },
  },
  {
    version: '0.38.1',
    date: '2026-11-21',
    text: {
      sv: ["Snabbare: när ett projekt eller exempel öppnas räknas varje verktygsbana bara en gång (tidigare två). Reliefer och V-gravyr blir klara ungefär dubbelt så fort."],
      en: ["Faster: when a project or example is opened, each toolpath is now calculated once (previously twice). Reliefs and V-carving are ready about twice as fast."],
      fr: ["Plus rapide : à l’ouverture d’un projet ou d’un exemple, chaque parcours n’est plus calculé qu’une fois (deux auparavant). Reliefs et gravure en V sont prêts environ deux fois plus vite."],
      de: ["Schneller: Beim Öffnen eines Projekts oder Beispiels wird jede Bahn nur noch einmal berechnet (bisher zweimal). Reliefs und V-Gravuren sind etwa doppelt so schnell fertig."],
      es: ["Más rápido: al abrir un proyecto o ejemplo, cada trayectoria se calcula una sola vez (antes, dos). Los relieves y el grabado en V están listos aproximadamente el doble de rápido."],
      pl: ["Szybciej: po otwarciu projektu lub przykładu każda ścieżka jest liczona tylko raz (wcześniej dwa razy). Reliefy i grawerowanie V są gotowe mniej więcej dwa razy szybciej."],
      uk: ["Швидше: під час відкриття проєкту чи прикладу кожна траєкторія обчислюється лише один раз (раніше двічі). Рельєфи та V-гравіювання готові приблизно вдвічі швидше."],
    },
  },
  {
    version: '0.38.0',
    date: '2026-11-21',
    text: {
      sv: ["Telefon: Inställning öppnas som ett ark med maskin, material, mått och verktyg i ett vanligt formulär. I bandet visas en sammanfattning (maskin, material, tjocklek, storlek) som öppnar arket.", "När en grövre fräs väljs automatiskt för att skärlängden ska räcka står det nu i banans egenskaper, under Verktyg.", "G-koden för alla exempelprojekt kontrolleras automatiskt vid varje bygge – bland annat att fräsen aldrig går djupare än materialet och att snabbförflyttningar aldrig går genom materialet."],
      en: ["Phone: Setup opens as a sheet with machine, material, size and tool in a regular form. The ribbon shows a summary (machine, material, thickness, size) that opens the sheet.", "When a larger cutter is chosen automatically so the cutting length reaches, it is now stated in the toolpath properties, under Tool.", "The G-code for all example projects is checked automatically on every build – including that the cutter never goes deeper than the material and that rapid moves never pass through the material."],
      fr: ["Téléphone : Configuration s’ouvre en panneau avec machine, matériau, dimensions et outil dans un formulaire classique. Le ruban affiche un résumé (machine, matériau, épaisseur, dimensions) qui ouvre le panneau.", "Quand une fraise plus grosse est choisie automatiquement pour que la longueur de coupe suffise, c’est désormais indiqué dans les propriétés du parcours, sous Outil.", "Le G-code de tous les projets d’exemple est vérifié automatiquement à chaque build – notamment que la fraise ne descend jamais plus bas que le matériau et que les déplacements rapides ne traversent jamais le matériau."],
      de: ["Handy: Einrichtung öffnet sich als Blatt mit Maschine, Material, Maßen und Werkzeug in einem normalen Formular. Im Menüband steht eine Zusammenfassung (Maschine, Material, Dicke, Größe), die das Blatt öffnet.", "Wird automatisch ein dickerer Fräser gewählt, damit die Schneidenlänge reicht, steht das jetzt in den Eigenschaften der Bahn unter Werkzeug.", "Der G-Code aller Beispielprojekte wird bei jedem Build automatisch geprüft – unter anderem, dass der Fräser nie tiefer als das Material geht und Eilgänge nie durch das Material führen."],
      es: ["Móvil: Configuración se abre como una hoja con máquina, material, medidas y herramienta en un formulario normal. La cinta muestra un resumen (máquina, material, grosor, tamaño) que abre la hoja.", "Cuando se elige automáticamente una fresa más gruesa para que alcance la longitud de corte, ahora se indica en las propiedades de la trayectoria, bajo Herramienta.", "El G-code de todos los proyectos de ejemplo se comprueba automáticamente en cada compilación: entre otras cosas, que la fresa nunca baje más que el material y que los movimientos rápidos nunca atraviesen el material."],
      pl: ["Telefon: Ustawienia otwierają się jako arkusz z maszyną, materiałem, wymiarami i narzędziem w zwykłym formularzu. Na wstążce widać podsumowanie (maszyna, materiał, grubość, rozmiar), które otwiera arkusz.", "Gdy automatycznie wybrany zostaje grubszy frez, aby wystarczyła długość ostrza, informacja pojawia się teraz we właściwościach ścieżki, pod Narzędziem.", "G-code wszystkich przykładowych projektów jest sprawdzany automatycznie przy każdej kompilacji – m.in. że frez nigdy nie schodzi głębiej niż materiał, a ruchy szybkie nigdy nie przechodzą przez materiał."],
      uk: ["Телефон: Налаштування відкриваються аркушем із верстатом, матеріалом, розмірами та інструментом у звичайній формі. На стрічці показано підсумок (верстат, матеріал, товщина, розмір), який відкриває аркуш.", "Коли автоматично вибрано товщу фрезу, щоб вистачило довжини різальної частини, це тепер зазначено у властивостях траєкторії під Інструментом.", "G-код усіх прикладів проєктів автоматично перевіряється під час кожної збірки – зокрема, що фреза ніколи не заходить глибше за матеріал, а швидкі переміщення ніколи не проходять крізь матеріал."],
    },
  },
  {
    version: '0.37.0',
    date: '2026-11-21',
    text: {
      sv: ["Profil och ficka väljer automatiskt en fräs vars skärlängd räcker till djupet – en genomskärning i 18 mm trä får t.ex. 6 mm-fräsen i stället för en som är för kort.", "Säkrare autosparning: projekt med foton sparas i webbläsarens databas, som rymmer mycket mer. Får något ändå inte plats får du veta det, i stället för att fotona tyst försvinner.", "Hjälprutorna stängs när du klickar, statusraden säger när simuleringen är klar, och markeringsram och vridhandtag visas bara under Design."],
      en: ["Profile and pocket automatically choose a cutter whose cutting length reaches the depth – a through cut in 18 mm wood now gets the 6 mm end mill instead of one that is too short.", "Safer autosave: projects with photos are saved in the browser database, which holds much more. If something still does not fit you are told, instead of the photos silently disappearing.", "Help popups close when you click, the status bar says when the simulation has finished, and the selection frame and rotation handle only show under Design."],
      fr: ["Contour et poche choisissent automatiquement une fraise dont la longueur de coupe atteint la profondeur – une découpe traversante dans 18 mm de bois prend par ex. la fraise de 6 mm au lieu d’une trop courte.", "Enregistrement automatique plus sûr : les projets avec photos sont enregistrés dans la base de données du navigateur, bien plus spacieuse. Si quelque chose ne tient toujours pas, vous êtes prévenu au lieu que les photos disparaissent sans bruit.", "Les bulles d’aide se ferment au clic, la barre d’état indique la fin de la simulation, et le cadre de sélection et la poignée de rotation n’apparaissent que dans Dessin."],
      de: ["Kontur und Tasche wählen automatisch einen Fräser, dessen Schneidenlänge für die Tiefe reicht – ein Durchschnitt in 18 mm Holz bekommt z. B. den 6-mm-Fräser statt eines zu kurzen.", "Sichereres automatisches Speichern: Projekte mit Fotos werden in der Datenbank des Browsers gespeichert, die viel mehr fasst. Passt trotzdem etwas nicht, erfahren Sie es, statt dass Fotos stillschweigend verschwinden.", "Hilfefenster schließen sich beim Klicken, die Statusleiste meldet das Ende der Simulation, und Auswahlrahmen und Drehgriff erscheinen nur unter Design."],
      es: ["Perfil y cajera eligen automáticamente una fresa cuya longitud de corte alcanza la profundidad: un corte pasante en madera de 18 mm recibe p. ej. la fresa de 6 mm en lugar de una demasiado corta.", "Autoguardado más seguro: los proyectos con fotos se guardan en la base de datos del navegador, que admite mucho más. Si algo aun así no cabe, se le avisa en lugar de que las fotos desaparezcan sin aviso.", "Las ventanas de ayuda se cierran al hacer clic, la barra de estado indica cuándo termina la simulación, y el marco de selección y el asa de giro solo aparecen en Diseño."],
      pl: ["Kontur i kieszeń automatycznie dobierają frez, którego długość ostrza wystarcza na głębokość – przecięcie 18 mm drewna dostaje np. frez 6 mm zamiast zbyt krótkiego.", "Bezpieczniejszy autozapis: projekty ze zdjęciami zapisują się w bazie danych przeglądarki, która mieści znacznie więcej. Jeśli coś mimo to się nie zmieści, dostaniesz informację, zamiast by zdjęcia po cichu znikały.", "Okienka pomocy zamykają się po kliknięciu, pasek stanu informuje o końcu symulacji, a ramka zaznaczenia i uchwyt obrotu pojawiają się tylko w Projektowaniu."],
      uk: ["Контур і кишеня автоматично вибирають фрезу, довжини різальної частини якої вистачає на глибину – наскрізний різ у 18 мм дерева отримує, напр., фрезу 6 мм замість закороткої.", "Надійніше автозбереження: проєкти з фото зберігаються в базі даних браузера, яка вміщує значно більше. Якщо щось усе ж не вміщується, ви про це дізнаєтеся, а не втратите фото непомітно.", "Підказки закриваються після кліку, рядок стану повідомляє про завершення симуляції, а рамка виділення й ручка повороту показуються лише в Дизайні."],
    },
  },
  {
    version: '0.36.1',
    date: '2026-11-21',
    text: {
      sv: ["Tipset om vridhandtaget nämner inte längre Shift-tangenten på telefon och surfplatta."],
      en: ["The rotation handle tip no longer mentions the Shift key on phones and tablets."],
      fr: ["L’astuce sur la poignée de rotation ne mentionne plus la touche Maj sur téléphone et tablette."],
      de: ["Der Hinweis zum Drehgriff erwähnt auf Handy und Tablet die Umschalttaste nicht mehr."],
      es: ["El consejo del asa de giro ya no menciona la tecla Mayús en móvil y tableta."],
      pl: ["Podpowiedź o uchwycie obrotu nie wspomina już o klawiszu Shift na telefonie i tablecie."],
      uk: ["Підказка про ручку повороту більше не згадує клавішу Shift на телефоні й планшеті."],
    },
  },
  {
    version: '0.36.0',
    date: '2026-11-21',
    text: {
      sv: ["Telefon: Egenskaper öppnas som ett ark nerifrån – halvhögt så att du ser formen ovanför, dra i greppet uppåt för hela panelen och nedåt för att stänga.", "Snabbknappar när något är markerat på telefon och surfplatta: vrid ±15°, räta upp, duplicera, ta bort och öppna egenskaperna."],
      en: ["Phone: Properties opens as a sheet from the bottom – half height so you can see the shape above, drag the handle up for the full panel and down to close.", "Quick buttons when something is selected on phones and tablets: rotate ±15°, straighten, duplicate, delete and open the properties."],
      fr: ["Téléphone : les Propriétés s’ouvrent en panneau depuis le bas – à mi-hauteur pour voir la forme au-dessus ; tirez la poignée vers le haut pour tout afficher, vers le bas pour fermer.", "Boutons rapides quand un élément est sélectionné sur téléphone et tablette : pivoter de ±15°, redresser, dupliquer, supprimer et ouvrir les propriétés."],
      de: ["Handy: Eigenschaften öffnen sich als Blatt von unten – halbhoch, damit die Form darüber sichtbar bleibt; Griff nach oben ziehen für das ganze Feld, nach unten zum Schließen.", "Schnellknöpfe bei einer Auswahl auf Handy und Tablet: um ±15° drehen, gerade ausrichten, duplizieren, löschen und Eigenschaften öffnen."],
      es: ["Móvil: Propiedades se abre como una hoja desde abajo, a media altura para ver la forma encima; arrastre el asa hacia arriba para el panel completo y hacia abajo para cerrar.", "Botones rápidos al seleccionar algo en móvil y tableta: girar ±15°, enderezar, duplicar, eliminar y abrir las propiedades."],
      pl: ["Telefon: Właściwości otwierają się jako arkusz od dołu – do połowy wysokości, by widzieć kształt powyżej; przeciągnij uchwyt w górę, aby pokazać całość, w dół, aby zamknąć.", "Szybkie przyciski po zaznaczeniu na telefonie i tablecie: obrót o ±15°, wyprostuj, duplikuj, usuń i otwórz właściwości."],
      uk: ["Телефон: Властивості відкриваються аркушем знизу – на пів висоти, щоб бачити фігуру над ним; потягніть ручку вгору для всієї панелі, вниз – щоб закрити.", "Швидкі кнопки, коли щось виділено на телефоні й планшеті: поворот на ±15°, вирівняти, дублювати, видалити та відкрити властивості."],
    },
  },
  {
    version: '0.35.0',
    date: '2026-11-21',
    text: {
      sv: ["Bättre på telefon: flikarna ligger längst ner nära tummen, verktygsbandet är kompaktare och visar en pil när fler verktyg finns åt sidan, och hjälp, feedback, nybörjarläge, tema och maskininställning finns i Mer-menyn (⋯). Vyns knappar är samlade under en knapp, och tipsrutan krockar inte längre med Egenskaper-knappen. På datorn ser allt ut som förut."],
      en: ["Better on phones: the tabs sit at the bottom within thumb reach, the ribbon is more compact and shows an arrow when more tools are off to the side, and help, feedback, beginner mode, theme and machine setup are in the More menu (⋯). The view buttons are gathered under one button, and the hint no longer overlaps the Properties button. On a computer everything looks as before."],
      fr: ["Mieux sur téléphone : les onglets sont en bas, à portée du pouce, le ruban est plus compact et affiche une flèche quand d’autres outils sont sur le côté, et l’aide, les commentaires, le mode débutant, le thème et la configuration de la machine sont dans le menu Plus (⋯). Les boutons de vue sont regroupés sous un bouton, et l’astuce ne chevauche plus le bouton Propriétés. Sur ordinateur, rien ne change."],
      de: ["Besser auf dem Handy: die Reiter liegen unten in Daumennähe, das Menüband ist kompakter und zeigt einen Pfeil, wenn seitlich weitere Werkzeuge liegen, und Hilfe, Feedback, Einsteigermodus, Design und Maschineneinrichtung stehen im Mehr-Menü (⋯). Die Ansichtsknöpfe sind unter einem Knopf zusammengefasst, und der Hinweis überdeckt den Eigenschaften-Knopf nicht mehr. Am Computer sieht alles aus wie bisher."],
      es: ["Mejor en el móvil: las pestañas están abajo, al alcance del pulgar, la cinta es más compacta y muestra una flecha cuando hay más herramientas a un lado, y la ayuda, los comentarios, el modo principiante, el tema y la configuración de la máquina están en el menú Más (⋯). Los botones de vista se agrupan bajo un botón y el consejo ya no tapa el botón Propiedades. En el ordenador todo se ve como antes."],
      pl: ["Wygodniej na telefonie: karty są na dole, pod kciukiem, wstążka jest bardziej zwarta i pokazuje strzałkę, gdy z boku są kolejne narzędzia, a pomoc, opinie, tryb początkującego, motyw i ustawienia maszyny są w menu Więcej (⋯). Przyciski widoku zebrano pod jednym przyciskiem, a podpowiedź nie zasłania już przycisku Właściwości. Na komputerze wszystko wygląda jak dotąd."],
      uk: ["Зручніше на телефоні: вкладки внизу, під великим пальцем, стрічка компактніша й показує стрілку, коли збоку є ще інструменти, а довідка, відгук, режим новачка, тема та налаштування верстата – у меню Ще (⋯). Кнопки виду зібрано під однією кнопкою, а підказка більше не перекриває кнопку Властивості. На комп’ютері все виглядає як раніше."],
    },
  },
  {
    version: '0.34.0',
    date: '2026-11-21',
    text: {
      sv: ["Vrid former och bilder: dra i den runda knappen ovanför markeringen (steg om 1°, håll Shift för 15°), eller ange vinkeln i egenskaperna. Bilder har nu också en vinkel.", "Räta upp: vrider en sned form den minsta vinkel som behövs för att den ska ligga rakt. Det spårade fotot följer med när formerna vrids."],
      en: ["Rotate shapes and images: drag the round knob above the selection (1° steps, hold Shift for 15°), or enter the angle in the properties. Images now have an angle too.", "Straighten: rotates a skewed shape by the smallest angle needed to make it straight. The traced photo follows when the shapes are rotated."],
      fr: ["Faire pivoter formes et images : faites glisser le bouton rond au-dessus de la sélection (pas de 1°, Maj pour 15°) ou saisissez l’angle dans les propriétés. Les images ont désormais aussi un angle.", "Redresser : fait pivoter une forme de travers du plus petit angle nécessaire pour la mettre droite. La photo tracée suit quand les formes pivotent."],
      de: ["Formen und Bilder drehen: den runden Griff über der Auswahl ziehen (1°-Schritte, Umschalt für 15°) oder den Winkel in den Eigenschaften eingeben. Bilder haben jetzt auch einen Winkel.", "Gerade ausrichten: dreht eine schiefe Form um den kleinsten nötigen Winkel, damit sie gerade liegt. Das nachgezeichnete Foto dreht sich mit."],
      es: ["Girar formas e imágenes: arrastre el botón redondo sobre la selección (pasos de 1°, Mayús para 15°) o escriba el ángulo en las propiedades. Las imágenes ahora también tienen ángulo.", "Enderezar: gira una forma torcida el ángulo mínimo necesario para que quede recta. La foto trazada acompaña a las formas al girarlas."],
      pl: ["Obracanie kształtów i obrazów: przeciągnij okrągły uchwyt nad zaznaczeniem (co 1°, Shift – co 15°) albo wpisz kąt we właściwościach. Obrazy mają teraz także kąt.", "Wyprostuj: obraca krzywo leżący kształt o najmniejszy potrzebny kąt. Obrysowane zdjęcie obraca się razem z kształtami."],
      uk: ["Поворот фігур і зображень: перетягніть круглу ручку над виділенням (крок 1°, Shift – 15°) або введіть кут у властивостях. Зображення тепер теж мають кут.", "Вирівняти: повертає косу фігуру на найменший потрібний кут, щоб вона лежала рівно. Обведене фото повертається разом із фігурами."],
    },
  },
  {
    version: '0.33.0',
    date: '2026-11-21',
    text: {
      sv: ["Nytt: Spåra bild (Design → Bild). Gör om ett foto av föremål eller en skiss till redigerbara vektorer. Lägg föremålen på ett A4-, A3- eller Letter-papper: hörnen hittas automatiskt, perspektivet korrigeras och måtten blir rätt. Lägen för objekt (siluetter med hål), kontur och mittlinje, förskjutning runt konturen, och foto direkt med kameran på mobilen. Allt sker i webbläsaren – bilderna laddas inte upp.", "Kontur: skapa en förskjuten kontur utåt eller inåt (t.ex. spel runt ett verktyg), och slå ihop eller dela upp formers banor.", "Export → Vektorer: spara former som SVG eller DXF i millimeter, eller som PDF i skala 1:1 med kontrollinjal för utskrift."],
      en: ["New: Trace image (Design → Image). Turns a photo of objects or a sketch into editable vectors. Put the objects on an A4, A3 or Letter sheet: the corners are found automatically, the perspective is corrected and the dimensions come out right. Modes for objects (silhouettes with holes), outline and centreline, an offset around the contour, and photos straight from the phone camera. Everything runs in the browser – images are not uploaded.", "Contour: create an offset contour outward or inward (e.g. clearance around a tool), and combine or separate the paths of shapes.", "Export → Vectors: save shapes as SVG or DXF in millimetres, or as a 1:1 PDF with a check ruler for printing."],
      fr: ["Nouveau : Tracer une image (Dessin → Image). Transforme la photo d’objets ou un croquis en vecteurs modifiables. Posez les objets sur une feuille A4, A3 ou Letter : les coins sont détectés automatiquement, la perspective est corrigée et les cotes sont justes. Modes objets (silhouettes avec trous), contour et ligne médiane, décalage autour du contour, et photo directement avec l’appareil du téléphone. Tout se fait dans le navigateur – les images ne sont pas envoyées.", "Contour : créez un contour décalé vers l’extérieur ou l’intérieur (p. ex. un jeu autour d’un outil), et combinez ou séparez les chemins des formes.", "Export → Vecteurs : enregistrez les formes en SVG ou DXF en millimètres, ou en PDF à l’échelle 1:1 avec règle de contrôle pour l’impression."],
      de: ["Neu: Bild nachzeichnen (Design → Bild). Macht aus einem Foto von Gegenständen oder einer Skizze bearbeitbare Vektoren. Gegenstände auf ein A4-, A3- oder Letter-Blatt legen: die Ecken werden automatisch gefunden, die Perspektive korrigiert und die Maße stimmen. Modi für Objekte (Silhouetten mit Löchern), Kontur und Mittellinie, Versatz um die Kontur und Fotos direkt mit der Handykamera. Alles läuft im Browser – Bilder werden nicht hochgeladen.", "Kontur: versetzte Kontur nach außen oder innen erstellen (z. B. Spiel um ein Werkzeug) und Pfade von Formen zusammenfügen oder aufteilen.", "Export → Vektoren: Formen als SVG oder DXF in Millimetern speichern oder als PDF im Maßstab 1:1 mit Kontrolllineal zum Drucken."],
      es: ["Nuevo: Trazar imagen (Diseño → Imagen). Convierte una foto de objetos o un boceto en vectores editables. Coloque los objetos sobre una hoja A4, A3 o Letter: las esquinas se detectan automáticamente, se corrige la perspectiva y las medidas salen correctas. Modos de objetos (siluetas con agujeros), contorno y línea central, desfase alrededor del contorno y fotos directamente con la cámara del móvil. Todo ocurre en el navegador: las imágenes no se suben.", "Contorno: cree un contorno desfasado hacia fuera o hacia dentro (p. ej. holgura alrededor de una herramienta) y combine o separe los trazados de las formas.", "Exportar → Vectores: guarde formas como SVG o DXF en milímetros, o como PDF a escala 1:1 con regla de control para imprimir."],
      pl: ["Nowość: Obrysuj obraz (Projektowanie → Obraz). Zamienia zdjęcie przedmiotów lub szkic w edytowalne wektory. Połóż przedmioty na kartce A4, A3 lub Letter: narożniki są wykrywane automatycznie, perspektywa korygowana, a wymiary są prawidłowe. Tryby obiektów (sylwetki z otworami), konturu i linii środkowej, odsunięcie wokół konturu oraz zdjęcia prosto z aparatu telefonu. Wszystko dzieje się w przeglądarce – obrazy nie są wysyłane.", "Kontur: utwórz odsunięty kontur na zewnątrz lub do wewnątrz (np. luz wokół narzędzia) oraz łącz lub rozdzielaj ścieżki kształtów.", "Eksport → Wektory: zapisz kształty jako SVG lub DXF w milimetrach albo jako PDF w skali 1:1 z linijką kontrolną do druku."],
      uk: ["Нове: Обвести зображення (Дизайн → Зображення). Перетворює фото предметів або ескіз на редаговані вектори. Покладіть предмети на аркуш A4, A3 або Letter: кути знаходяться автоматично, перспектива виправляється, а розміри виходять правильні. Режими об’єктів (силуети з отворами), контуру й середньої лінії, зміщення навколо контуру та фото просто з камери телефона. Усе відбувається в браузері – зображення не завантажуються.", "Контур: створюйте зміщений контур назовні або всередину (напр., зазор навколо інструмента), об’єднуйте чи розділяйте шляхи фігур.", "Експорт → Вектори: зберігайте фігури як SVG або DXF у міліметрах або як PDF у масштабі 1:1 з контрольною лінійкою для друку."],
    },
  },
  {
    version: '0.32.0',
    date: '2026-11-21',
    text: {
      sv: ["V-gravyr och inlägg går mycket fortare: överflödiga varv tas bort, förflyttningarna ordnas och inläggens plana botten stegas glesare – samma resultat. Exemplets skylt tar 62 minuter i stället för 3,5 timmar, inläggets ficka 21 minuter i stället för över 5 timmar.", "V-gravyr: nytt val Metod → Mittlinje. Fräsen följer formens mittlinje och går djupare där formen är bredare – ännu snabbare för text (skylten: 24 minuter).", "V-fräsen går aldrig djupare än konens höjd – djupare formar konen inte väggen och skaftet tar i. Där blir det plan botten i stället.", "Simuleringen kan spelas i verklig hastighet (1×) eller snabbare. Översikten spelar hela körningen på 40 sekunder och visar hur mycket snabbare än maskinen det går."],
      en: ["V-carving and inlays are much faster: redundant passes are removed, moves are ordered and the inlay’s flat bottom uses wider steps – same result. The example sign takes 62 minutes instead of 3.5 hours, the inlay pocket 21 minutes instead of over 5 hours.", "V-carving: new option Method → Centreline. The bit follows the shape’s centreline and goes deeper where the shape is wider – even faster for text (the sign: 24 minutes).", "The V-bit never goes deeper than its cone height – deeper, the cone no longer forms the wall and the shank rubs. A flat bottom is used there instead.", "The simulation can play at real speed (1×) or faster. Overview plays the whole job in 40 seconds and shows how much faster than the machine it runs."],
      fr: ["La gravure en V et les incrustations sont beaucoup plus rapides : passes inutiles supprimées, déplacements ordonnés et fond plat de l’incrustation avec un pas plus large – même résultat. L’enseigne d’exemple prend 62 minutes au lieu de 3,5 heures, la poche d’incrustation 21 minutes au lieu de plus de 5 heures.", "Gravure en V : nouvelle option Méthode → Ligne médiane. La fraise suit la ligne médiane de la forme et descend plus profond là où elle est plus large – encore plus rapide pour le texte (l’enseigne : 24 minutes).", "La fraise en V ne descend jamais plus bas que la hauteur de son cône – au-delà, le cône ne forme plus la paroi et la queue frotte. Un fond plat est utilisé à la place.", "La simulation peut être lue en vitesse réelle (1×) ou plus vite. L’aperçu joue tout le travail en 40 secondes et indique combien de fois plus vite que la machine."],
      de: ["V-Gravur und Intarsien sind viel schneller: überflüssige Bahnen entfallen, Verfahrwege werden geordnet und der flache Boden der Intarsie mit größerem Abstand gefräst – gleiches Ergebnis. Das Beispielschild dauert 62 Minuten statt 3,5 Stunden, die Intarsientasche 21 Minuten statt über 5 Stunden.", "V-Gravur: neue Option Methode → Mittellinie. Der Fräser folgt der Mittellinie der Form und geht tiefer, wo sie breiter ist – noch schneller bei Text (das Schild: 24 Minuten).", "Der V-Fräser geht nie tiefer als seine Kegelhöhe – tiefer formt der Kegel die Wand nicht mehr und der Schaft reibt. Dort entsteht stattdessen ein flacher Boden.", "Die Simulation lässt sich in Echtzeit (1×) oder schneller abspielen. Die Übersicht spielt den ganzen Auftrag in 40 Sekunden ab und zeigt, wie viel schneller als die Maschine sie läuft."],
      es: ["El grabado en V y las incrustaciones son mucho más rápidos: se eliminan pasadas innecesarias, se ordenan los desplazamientos y el fondo plano de la incrustación usa pasos más anchos, con el mismo resultado. El letrero de ejemplo tarda 62 minutos en lugar de 3,5 horas y la cajera de la incrustación 21 minutos en lugar de más de 5 horas.", "Grabado en V: nueva opción Método → Línea central. La fresa sigue la línea central de la forma y baja más donde es más ancha; aún más rápido para texto (el letrero: 24 minutos).", "La fresa en V nunca baja más que la altura de su cono: más abajo, el cono ya no forma la pared y el vástago roza. Allí se usa un fondo plano.", "La simulación puede reproducirse a velocidad real (1×) o más rápido. La vista general reproduce todo el trabajo en 40 segundos e indica cuántas veces más rápido que la máquina va."],
      pl: ["Grawerowanie V i intarsje są dużo szybsze: zbędne przejścia usunięto, przejazdy uporządkowano, a płaskie dno intarsji frezowane jest z większym krokiem – ten sam wynik. Przykładowy szyld trwa 62 minuty zamiast 3,5 godziny, kieszeń intarsji 21 minut zamiast ponad 5 godzin.", "Grawerowanie V: nowa opcja Metoda → Linia środkowa. Frez podąża linią środkową kształtu i schodzi głębiej tam, gdzie jest szerszy – jeszcze szybciej dla tekstu (szyld: 24 minuty).", "Frez V nigdy nie schodzi głębiej niż wysokość stożka – głębiej stożek nie formuje ścianki, a trzonek się ociera. Tam powstaje płaskie dno.", "Symulację można odtwarzać w czasie rzeczywistym (1×) lub szybciej. Podgląd odtwarza całe zadanie w 40 sekund i pokazuje, ile razy szybciej niż maszyna."],
      uk: ["V-гравіювання та інкрустації значно швидші: зайві проходи прибрано, переміщення впорядковано, а пласке дно інкрустації фрезерується з більшим кроком – результат той самий. Вивіска з прикладу займає 62 хвилини замість 3,5 години, кишеня інкрустації – 21 хвилину замість понад 5 годин.", "V-гравіювання: новий вибір Метод → Середня лінія. Фреза йде середньою лінією фігури й заглиблюється там, де вона ширша, – ще швидше для тексту (вивіска: 24 хвилини).", "V-фреза ніколи не йде глибше за висоту свого конуса – глибше конус не формує стінку, а хвостовик треться. Там натомість буде пласке дно.", "Симуляцію можна відтворювати в реальному часі (1×) або швидше. Огляд відтворює всю роботу за 40 секунд і показує, у скільки разів швидше за верстат."],
    },
  },
  {
    version: '0.31.0',
    date: '2026-11-20',
    text: {
      sv: ["Nytt välkomstfönster: välj maskintyp och se vad desktopCAM kan göra med nio färdiga exempel – skylt, inlägg, relief, kugghjul, fotogravyr, underlägg, plasmasköld, spiralbild och kort. Öppna ett exempel och simulera direkt. Öppnas med ?-knappen eller Arkiv → Exempel, och leder vidare till rundturen.", "Rättat: hål ritade som egna former skärs nu som hål vid plasmaskärning och fräsprofil utsida (de försvann tidigare).", "Rättat: ändringar som görs medan en bana räknas gäller nu – banan räknas om.", "Rättat: sidhuvudet var för brett på smala mobiler."],
      en: ["New welcome window: choose a machine type and see what desktopCAM can do with nine ready-made examples – sign, inlay, relief, gears, photo engraving, coaster, plasma shield, spiral picture and card. Open an example and simulate it right away. Open it with the ? button or File → Examples; it leads on to the tour.", "Fixed: holes drawn as separate shapes are now cut as holes in plasma cutting and outside router profiles (they used to disappear).", "Fixed: changes made while a toolpath is being calculated now take effect – the toolpath is recalculated.", "Fixed: the header was too wide on narrow phones."],
      fr: ["Nouvelle fenêtre de bienvenue : choisissez un type de machine et découvrez ce que desktopCAM sait faire avec neuf exemples prêts à l’emploi – enseigne, incrustation, relief, engrenages, gravure photo, sous-verre, bouclier plasma, image en spirale et carte. Ouvrez un exemple et simulez-le tout de suite. Accessible par le bouton ? ou Fichier → Exemples ; elle mène aussi à la visite guidée.", "Corrigé : les trous dessinés comme formes séparées sont maintenant découpés comme trous en découpe plasma et en profil extérieur à la fraiseuse (ils disparaissaient).", "Corrigé : les modifications faites pendant le calcul d’un parcours sont désormais prises en compte – le parcours est recalculé.", "Corrigé : l’en-tête était trop large sur les téléphones étroits."],
      de: ["Neues Willkommensfenster: Maschinentyp wählen und mit neun fertigen Beispielen sehen, was desktopCAM kann – Schild, Intarsie, Relief, Zahnräder, Fotogravur, Untersetzer, Plasmaschild, Spiralbild und Karte. Ein Beispiel öffnen und sofort simulieren. Erreichbar über die ?-Schaltfläche oder Datei → Beispiele; von dort geht es zum Rundgang.", "Behoben: Als eigene Formen gezeichnete Löcher werden beim Plasmaschneiden und bei Fräsprofilen außen jetzt als Löcher geschnitten (sie verschwanden bisher).", "Behoben: Änderungen während der Berechnung einer Bahn werden jetzt übernommen – die Bahn wird neu berechnet.", "Behoben: Die Kopfzeile war auf schmalen Handys zu breit."],
      es: ["Nueva ventana de bienvenida: elija un tipo de máquina y vea lo que desktopCAM puede hacer con nueve ejemplos listos: letrero, incrustación, relieve, engranajes, grabado de foto, posavasos, escudo de plasma, imagen en espiral y tarjeta. Abra un ejemplo y simúlelo al instante. Se abre con el botón ? o Archivo → Ejemplos y lleva al recorrido.", "Corregido: los agujeros dibujados como formas separadas ahora se cortan como agujeros en el corte por plasma y en los perfiles exteriores de fresadora (antes desaparecían).", "Corregido: los cambios hechos mientras se calcula una trayectoria ahora se aplican: la trayectoria se recalcula.", "Corregido: la cabecera era demasiado ancha en móviles estrechos."],
      pl: ["Nowe okno powitalne: wybierz typ maszyny i zobacz, co potrafi desktopCAM, na dziewięciu gotowych przykładach – szyld, intarsja, relief, koła zębate, grawer zdjęcia, podkładka, tarcza plazmowa, obraz spiralą i kartka. Otwórz przykład i od razu go zasymuluj. Otwiera się przyciskiem ? lub Plik → Przykłady i prowadzi do przewodnika.", "Poprawiono: otwory narysowane jako osobne kształty są teraz wycinane jako otwory przy cięciu plazmą i profilu zewnętrznym frezarki (wcześniej znikały).", "Poprawiono: zmiany wprowadzone podczas obliczania ścieżki są teraz uwzględniane – ścieżka jest przeliczana.", "Poprawiono: nagłówek był za szeroki na wąskich telefonach."],
      uk: ["Нове вікно привітання: виберіть тип верстата й подивіться, що вміє desktopCAM, на дев’яти готових прикладах – вивіска, інкрустація, рельєф, шестерні, гравіювання фото, підставка, плазмовий щит, спіральне зображення й листівка. Відкрийте приклад і одразу симулюйте його. Відкривається кнопкою ? або Файл → Приклади й веде до екскурсії.", "Виправлено: отвори, намальовані окремими фігурами, тепер вирізаються як отвори під час плазмового різання та зовнішнього профілю фрезера (раніше зникали).", "Виправлено: зміни, зроблені під час розрахунку траєкторії, тепер враховуються – траєкторія перераховується.", "Виправлено: заголовок був зашироким на вузьких телефонах."],
    },
  },
  {
    version: '0.30.0',
    date: '2026-11-20',
    text: {
      sv: ["Gränssnittet visar nu bara det som gäller den valda maskinen: Verktygsbanor har bara maskinens banor (knappen Byt maskin visar var övriga finns), reliefer och Bild till relief finns med fräs, och materiallistan visar bara material maskinen kan bearbeta.", "Rättat: med penplotter föreslog egenskaperna för en form fräsens banor – nu Rita och Fyllning."],
      en: ["The interface now shows only what applies to the selected machine: Toolpaths has just that machine's toolpaths (the Change machine button shows where the others are), reliefs and Image to relief are available with a router, and the material list shows only materials the machine can work.", "Fixed: with a pen plotter the properties for a shape suggested router toolpaths – now Draw and Fill."],
      fr: ["L’interface n’affiche plus que ce qui concerne la machine choisie : Parcours ne montre que les parcours de cette machine (le bouton Changer de machine indique où trouver les autres), les reliefs et Image en relief sont disponibles avec une fraiseuse, et la liste des matériaux ne montre que ceux que la machine peut travailler.", "Corrigé : avec un traceur, les propriétés d’une forme proposaient des parcours de fraiseuse – désormais Dessiner et Remplissage."],
      de: ["Die Oberfläche zeigt jetzt nur, was für die gewählte Maschine gilt: Werkzeugwege enthält nur die Bahnen dieser Maschine (die Schaltfläche Maschine wechseln zeigt, wo die übrigen sind), Reliefs und Bild zu Relief gibt es mit der Fräse, und die Materialliste zeigt nur Materialien, die die Maschine bearbeiten kann.", "Behoben: Beim Stiftplotter schlugen die Eigenschaften einer Form Fräsbahnen vor – jetzt Zeichnen und Füllung."],
      es: ["La interfaz ahora muestra solo lo que corresponde a la máquina elegida: Trayectorias tiene solo las de esa máquina (el botón Cambiar máquina indica dónde están las demás), los relieves e Imagen a relieve están disponibles con fresadora, y la lista de materiales muestra solo los que la máquina puede trabajar.", "Corregido: con plóter, las propiedades de una forma proponían trayectorias de fresadora; ahora Dibujar y Relleno."],
      pl: ["Interfejs pokazuje teraz tylko to, co dotyczy wybranej maszyny: Ścieżki zawierają tylko ścieżki tej maszyny (przycisk Zmień maszynę wskazuje, gdzie są pozostałe), reliefy i Obraz na relief są dostępne z frezarką, a lista materiałów pokazuje tylko te, które maszyna może obrabiać.", "Poprawiono: przy ploterze właściwości kształtu proponowały ścieżki frezarki – teraz Rysuj i Wypełnienie."],
      uk: ["Інтерфейс тепер показує лише те, що стосується вибраного верстата: у Траєкторіях лише траєкторії цього верстата (кнопка Змінити верстат показує, де інші), рельєфи та Зображення в рельєф доступні з фрезером, а список матеріалів містить лише ті, які верстат може обробляти.", "Виправлено: з плотером властивості фігури пропонували траєкторії фрезера – тепер Малювати й Заповнення."],
    },
  },
  {
    version: '0.29.0',
    date: '2026-11-20',
    text: {
      sv: ["Bilder hör nu till Design: Design → Bild har valen Importera bild och Bild till relief. Bilden sparas i färg i projektet, syns på ämnet i 3D-vyn, kan dras, skalas och döljas, och finns under Bilder i projektträdet. Fotogravyr och Bild till linjer följer bildens läge och storlek, och banor med bilder sparas nu i projektet."],
      en: ["Images now belong to Design: Design → Image offers Import image and Image to relief. The image is saved in colour in the project, shows on the stock in the 3D view, can be dragged, scaled and hidden, and is listed under Images in the project tree. Photo engraving and Image to lines follow the image’s position and size, and toolpaths with images are now saved in the project."],
      fr: ["Les images font désormais partie du Dessin : Dessin → Image propose Importer une image et Image en relief. L’image est enregistrée en couleur dans le projet, apparaît sur le brut dans la vue 3D, peut être déplacée, mise à l’échelle et masquée, et figure sous Images dans l’arborescence. La gravure photo et Image en lignes suivent la position et la taille de l’image, et les parcours avec images sont désormais enregistrés dans le projet."],
      de: ["Bilder gehören jetzt zu Design: Design → Bild bietet Bild importieren und Bild zu Relief. Das Bild wird farbig im Projekt gespeichert, erscheint in der 3D-Ansicht auf dem Rohteil, lässt sich ziehen, skalieren und ausblenden und steht im Projektbaum unter Bilder. Fotogravur und Bild zu Linien folgen Lage und Größe des Bildes, und Bahnen mit Bildern werden jetzt im Projekt gespeichert."],
      es: ["Las imágenes pasan a Diseño: Diseño → Imagen ofrece Importar imagen e Imagen a relieve. La imagen se guarda en color en el proyecto, se ve sobre el material en la vista 3D, se puede arrastrar, escalar y ocultar, y aparece en Imágenes en el árbol del proyecto. El grabado de foto e Imagen a líneas siguen la posición y el tamaño de la imagen, y las trayectorias con imágenes ahora se guardan en el proyecto."],
      pl: ["Obrazy należą teraz do Projektowania: Projektowanie → Obraz zawiera Importuj obraz i Obraz na relief. Obraz zapisuje się w kolorze w projekcie, widać go na materiale w widoku 3D, można go przeciągać, skalować i ukrywać, a w drzewie projektu jest w sekcji Obrazy. Grawerowanie zdjęcia i Obraz na linie podążają za położeniem i rozmiarem obrazu, a ścieżki z obrazami zapisują się teraz w projekcie."],
      uk: ["Зображення тепер належать до Дизайну: Дизайн → Зображення містить Імпорт зображення та Зображення в рельєф. Зображення зберігається в кольорі в проєкті, видно його на заготовці в 3D-виді, його можна перетягувати, масштабувати й ховати, а в дереві проєкту воно є в розділі Зображення. Гравіювання фото та Зображення в лінії слідують за положенням і розміром зображення, а траєкторії із зображеннями тепер зберігаються в проєкті."],
    },
  },
  {
    version: '0.28.1',
    date: '2026-11-20',
    text: {
      sv: ["Rättat: stora bilder som spiral (och andra mycket långa banor) gav felet \"Maximum call stack size exceeded\". Även exporten av sådana banor till en fil per lager är rättad."],
      en: ["Fixed: large images as a spiral (and other very long toolpaths) gave the error \"Maximum call stack size exceeded\". Exporting such toolpaths to one file per layer is fixed too."],
      fr: ["Corrigé : les grandes images en spirale (et d’autres parcours très longs) donnaient l’erreur « Maximum call stack size exceeded ». L’export de ces parcours en un fichier par calque est aussi corrigé."],
      de: ["Behoben: Große Bilder als Spirale (und andere sehr lange Bahnen) gaben den Fehler „Maximum call stack size exceeded“. Auch der Export solcher Bahnen als eine Datei pro Ebene ist behoben."],
      es: ["Corregido: las imágenes grandes en espiral (y otras trayectorias muy largas) daban el error «Maximum call stack size exceeded». También se corrige la exportación de esas trayectorias en un archivo por capa."],
      pl: ["Poprawiono: duże obrazy jako spirala (i inne bardzo długie ścieżki) dawały błąd „Maximum call stack size exceeded”. Poprawiono też eksport takich ścieżek do pliku na warstwę."],
      uk: ["Виправлено: великі зображення спіраллю (та інші дуже довгі траєкторії) давали помилку «Maximum call stack size exceeded». Також виправлено експорт таких траєкторій у файл на шар."],
    },
  },
  {
    version: '0.28.0',
    date: '2026-11-20',
    text: {
      sv: ["Penplotter: ny bana Bild till linjer. Välj ett foto eller en bild och rita den som skraffering i upp till fyra tonlager, som en spiral som vågar sig i mörka partier, eller som prickar – enskilda eller hopbundna till en enda linje. Storlek, läge, linjeavstånd, kontrast och invertering går att ställa in."],
      en: ["Pen plotter: new toolpath Image to lines. Choose a photo or picture and draw it as hatching in up to four tone layers, as a spiral that wiggles in dark areas, or as dots – separate or joined into a single line. Size, position, line spacing, contrast and inversion are adjustable."],
      fr: ["Traceur à stylo : nouveau parcours Image en lignes. Choisissez une photo ou une image et dessinez-la en hachures jusqu’à quatre couches de ton, en spirale qui ondule dans les zones sombres, ou en points – séparés ou reliés en une seule ligne. Taille, position, écart, contraste et inversion sont réglables."],
      de: ["Stiftplotter: neue Bahn Bild zu Linien. Ein Foto oder Bild wählen und als Schraffur in bis zu vier Tonebenen, als Spirale, die in dunklen Bereichen schwingt, oder als Punkte zeichnen – einzeln oder zu einer einzigen Linie verbunden. Größe, Lage, Linienabstand, Kontrast und Umkehrung sind einstellbar."],
      es: ["Plóter de bolígrafo: nueva trayectoria Imagen a líneas. Elija una foto o imagen y dibújela como sombreado en hasta cuatro capas de tono, como una espiral que ondula en las zonas oscuras o como puntos, separados o unidos en una sola línea. Tamaño, posición, separación, contraste e inversión son ajustables."],
      pl: ["Ploter z pisakiem: nowa ścieżka Obraz na linie. Wybierz zdjęcie lub obraz i narysuj je jako kreskowanie w maksymalnie czterech warstwach tonów, jako spiralę falującą w ciemnych miejscach albo jako kropki – osobne lub połączone w jedną linię. Rozmiar, położenie, odstęp, kontrast i odwrócenie można ustawić."],
      uk: ["Плотер із ручкою: нова траєкторія «Зображення в лінії». Виберіть фото чи зображення й намалюйте його штрихуванням до чотирьох шарів тону, спіраллю, що хвилюється в темних місцях, або крапками – окремими чи з’єднаними в одну лінію. Розмір, положення, крок, контраст та інверсію можна налаштувати."],
    },
  },
  {
    version: '0.27.0',
    date: '2026-11-20',
    text: {
      sv: [
        "Ny maskintyp: penplotter. MPCNC, LowRider eller en GRBL-maskin med pennhållare på Z-axeln – pennan lyfts och sänks med Z, med inställbar höjd uppe och nere och väntetid efter sänkning.",
        "Nya banor för pennan: Rita följer formernas linjer (även text), och Fyllning fyller slutna former med linjer, korsskraffering eller konturer. Ritordningen optimeras så att pennan flyttas så lite som möjligt i luften.",
        "Pennor i verktygsbiblioteket med spetsbredd och bläckfärg, papper som material med pappersformat (A5–A2, Letter), och simuleringen visar bläcket i pennans färg. Flera färger: lägg dem i olika lager och spara en fil per lager eller med paus för pennbyte.",
      ],
      en: [
        "New machine type: pen plotter. MPCNC, LowRider or a GRBL machine with a pen holder on the Z axis – the pen is raised and lowered with Z, with adjustable up and down heights and a delay after lowering.",
        "New pen toolpaths: Draw follows the shapes’ lines (text too), and Fill fills closed shapes with lines, cross-hatching or contours. The drawing order is optimised so the pen moves as little as possible in the air.",
        "Pens in the tool library with tip width and ink colour, paper as a material with paper sizes (A5–A2, Letter), and the simulation shows the ink in the pen’s colour. Several colours: put them on different layers and save one file per layer or with a pause for pen changes.",
      ],
      fr: [
        "Nouveau type de machine : traceur à stylo. MPCNC, LowRider ou une machine GRBL avec porte-stylo sur l’axe Z – le stylo monte et descend avec Z, avec hauteurs réglables et une pause après la descente.",
        "Nouveaux parcours au stylo : Dessiner suit les lignes des formes (texte compris), et Remplissage remplit les formes fermées de lignes, de hachures croisées ou de contours. L’ordre de tracé est optimisé pour que le stylo se déplace le moins possible en l’air.",
        "Stylos dans la bibliothèque d’outils avec largeur de pointe et couleur d’encre, papier comme matériau avec formats (A5–A2, Letter), et la simulation montre l’encre dans la couleur du stylo. Plusieurs couleurs : placez-les sur des calques différents et enregistrez un fichier par calque ou avec une pause pour changer de stylo.",
      ],
      de: [
        "Neuer Maschinentyp: Stiftplotter. MPCNC, LowRider oder eine GRBL-Maschine mit Stifthalter an der Z-Achse – der Stift wird mit Z gehoben und gesenkt, mit einstellbaren Höhen und einer Pause nach dem Absenken.",
        "Neue Stiftbahnen: Zeichnen folgt den Linien der Formen (auch Schrift), Füllung füllt geschlossene Formen mit Linien, Kreuzschraffur oder Konturen. Die Zeichenreihenfolge wird optimiert, damit der Stift möglichst wenig in der Luft fährt.",
        "Stifte in der Werkzeugbibliothek mit Spitzenbreite und Tintenfarbe, Papier als Material mit Formaten (A5–A2, Letter), und die Simulation zeigt die Tinte in der Farbe des Stifts. Mehrere Farben: auf verschiedene Ebenen legen und eine Datei pro Ebene oder mit Pause zum Stiftwechsel speichern.",
      ],
      es: [
        "Nuevo tipo de máquina: plóter de bolígrafo. MPCNC, LowRider o una máquina GRBL con portabolígrafos en el eje Z: el bolígrafo sube y baja con Z, con alturas ajustables y pausa tras bajar.",
        "Nuevas trayectorias de bolígrafo: Dibujar sigue las líneas de las formas (también texto) y Relleno rellena formas cerradas con líneas, sombreado cruzado o contornos. El orden de dibujo se optimiza para que el bolígrafo se mueva lo menos posible en el aire.",
        "Bolígrafos en la biblioteca con ancho de punta y color de tinta, papel como material con tamaños (A5–A2, Letter), y la simulación muestra la tinta en el color del bolígrafo. Varios colores: póngalos en capas distintas y guarde un archivo por capa o con pausa para cambiar de bolígrafo.",
      ],
      pl: [
        "Nowy typ maszyny: ploter z pisakiem. MPCNC, LowRider lub maszyna GRBL z uchwytem pisaka na osi Z – pisak podnoszony i opuszczany osią Z, z regulowanymi wysokościami i pauzą po opuszczeniu.",
        "Nowe ścieżki pisaka: Rysuj podąża za liniami kształtów (także tekstem), a Wypełnienie wypełnia zamknięte kształty liniami, kreskowaniem krzyżowym lub konturami. Kolejność rysowania jest optymalizowana, by pisak jak najmniej poruszał się w powietrzu.",
        "Pisaki w bibliotece narzędzi z szerokością końcówki i kolorem tuszu, papier jako materiał z formatami (A5–A2, Letter), a symulacja pokazuje tusz w kolorze pisaka. Kilka kolorów: umieść je na różnych warstwach i zapisz plik na warstwę lub z pauzą na zmianę pisaka.",
      ],
      uk: [
        "Новий тип верстата: плотер із ручкою. MPCNC, LowRider або верстат GRBL з тримачем ручки на осі Z – ручка піднімається й опускається віссю Z, з налаштовуваними висотами та паузою після опускання.",
        "Нові траєкторії ручки: «Малювати» йде лініями фігур (і текстом), а «Заповнення» заповнює замкнені фігури лініями, перехресним штрихуванням або контурами. Порядок малювання оптимізується, щоб ручка якнайменше рухалася в повітрі.",
        "Ручки в бібліотеці інструментів із шириною стрижня й кольором чорнила, папір як матеріал з форматами (A5–A2, Letter), а симуляція показує чорнило кольором ручки. Кілька кольорів: розмістіть їх на різних шарах і зберігайте файл на шар або з паузою для заміни ручки.",
      ],
    },
  },
  {
    version: '0.26.0',
    date: '2026-11-19',
    text: {
      sv: [
        "Spara G-kod öppnar en dialog där du väljer vilka banor som sparas. Varje lager blir en egen fil med lagrets banor i ordning; inläggets ficka och plugg blir var sin fil. Visa G-kod kan visa valfri bana.",
        "Nytt val: olika verktyg i samma fil, med paus (M0) för verktygsbyte. Marlin visar vilket verktyg som ska i på displayen.",
        "Genomskärning efter Limma och plana: ett snitt rakt genom inlägget från sidan visar V-formen, limspalten och planingslinjen.",
        "Byte mellan Uppifrån och Iso behåller zoom och inramning, och Arbetsstycke/Arbetsyta behåller vinkeln. Visningsknapparna är avstängda under simuleringen.",
        "Rättat: pluggens bortfräsning av öar kunde skära rakt genom bokstäverna. Passningskontrollen räknar inte längre andra banor nära inlägget som glipor.",
      ],
      en: [
        "Save G-code opens a dialog where you choose which toolpaths to save. Each layer becomes its own file with its toolpaths in order; an inlay’s pocket and plug are separate files. View G-code can show any toolpath.",
        "New option: different tools in the same file, with a pause (M0) for tool changes. Marlin shows which tool to fit on the display.",
        "Cross-section after Glue and plane: a cut straight through the inlay from the side shows the V shape, the glue gap and the planing line.",
        "Switching between Top and Iso keeps zoom and framing, and Workpiece/Work area keep the angle. The view buttons are disabled during the simulation.",
        "Fixed: clearing islands in the plug could cut straight through the letters. The fit check no longer counts other toolpaths near the inlay as gaps.",
      ],
      fr: [
        "Enregistrer le G-code ouvre une fenêtre où vous choisissez les parcours à enregistrer. Chaque calque devient un fichier avec ses parcours dans l’ordre ; la poche et le bouchon d’une incrustation sont des fichiers séparés. Afficher le G-code peut montrer n’importe quel parcours.",
        "Nouvelle option : outils différents dans le même fichier, avec une pause (M0) pour le changement d’outil. Marlin affiche l’outil à monter.",
        "Coupe après Coller et raboter : une coupe à travers l’incrustation montre la forme en V, le joint de colle et la ligne de rabotage.",
        "Passer de Dessus à Iso conserve le zoom et le cadrage, et Pièce/Zone de travail conservent l’angle. Les boutons d’affichage sont désactivés pendant la simulation.",
        "Corrigé : l’évidement des îlots du bouchon pouvait couper à travers les lettres. Le contrôle d’ajustement ne compte plus les autres parcours proches comme des jours.",
      ],
      de: [
        "G-Code speichern öffnet einen Dialog zur Auswahl der Bahnen. Jede Ebene wird eine eigene Datei mit ihren Bahnen in Reihenfolge; Tasche und Stopfen einer Intarsie sind getrennte Dateien. G-Code anzeigen kann jede Bahn zeigen.",
        "Neue Option: verschiedene Werkzeuge in derselben Datei, mit Pause (M0) zum Werkzeugwechsel. Marlin zeigt das einzusetzende Werkzeug im Display.",
        "Schnitt nach Leimen und abrichten: ein Schnitt durch die Intarsie von der Seite zeigt V-Form, Leimfuge und Abrichtlinie.",
        "Der Wechsel zwischen Oben und Iso behält Zoom und Ausschnitt, Werkstück/Arbeitsbereich behalten den Winkel. Die Anzeige-Schaltflächen sind während der Simulation deaktiviert.",
        "Behoben: Das Ausräumen von Inseln im Stopfen konnte quer durch die Buchstaben schneiden. Die Passungsprüfung zählt andere Bahnen nahe der Intarsie nicht mehr als Spalten.",
      ],
      es: [
        "Guardar G-code abre un diálogo para elegir las trayectorias. Cada capa es un archivo con sus trayectorias en orden; la cajera y el tapón de una incrustación son archivos separados. Ver G-code puede mostrar cualquier trayectoria.",
        "Nueva opción: herramientas distintas en el mismo archivo, con pausa (M0) para el cambio. Marlin muestra en pantalla qué herramienta montar.",
        "Sección tras Encolar y cepillar: un corte a través de la incrustación muestra la forma en V, la junta de cola y la línea de cepillado.",
        "Cambiar entre Superior e Iso conserva el zoom y el encuadre, y Pieza/Área de trabajo conservan el ángulo. Los botones de vista se desactivan durante la simulación.",
        "Corregido: el vaciado de islas del tapón podía cortar a través de las letras. El control de ajuste ya no cuenta otras trayectorias cercanas como huecos.",
      ],
      pl: [
        "Zapisz G-code otwiera okno wyboru ścieżek. Każda warstwa to osobny plik z jej ścieżkami po kolei; kieszeń i wkładka intarsji to osobne pliki. Pokaż G-code może pokazać dowolną ścieżkę.",
        "Nowa opcja: różne narzędzia w jednym pliku, z pauzą (M0) na zmianę narzędzia. Marlin pokazuje na wyświetlaczu, jakie narzędzie założyć.",
        "Przekrój po Klejeniu i struganiu: cięcie przez intarsję z boku pokazuje kształt V, spoinę kleju i linię strugania.",
        "Przełączanie między Góra i Izo zachowuje powiększenie i kadr, a Detal/Obszar roboczy zachowują kąt. Przyciski widoku są wyłączone podczas symulacji.",
        "Poprawiono: wybieranie wysp we wkładce mogło przecinać litery. Kontrola pasowania nie liczy już innych ścieżek w pobliżu jako szczelin.",
      ],
      uk: [
        "«Зберегти G-код» відкриває діалог вибору траєкторій. Кожен шар стає окремим файлом з траєкторіями по порядку; кишеня й вставка інкрустації – окремі файли. «Показати G-код» може показати будь-яку траєкторію.",
        "Нова опція: різні інструменти в одному файлі з паузою (M0) для зміни інструмента. Marlin показує на дисплеї, який інструмент встановити.",
        "Переріз після «Склеїти й прострогати»: розріз крізь інкрустацію збоку показує V-форму, клейовий шов і лінію стругання.",
        "Перемикання між «Згори» та «Ізо» зберігає масштаб і кадр, а «Заготовка»/«Робоча зона» зберігають кут. Кнопки показу вимкнені під час симуляції.",
        "Виправлено: вибирання острівців у вставці могло прорізати літери. Перевірка посадки більше не вважає інші траєкторії поруч щілинами.",
      ],
    },
  },
  {
    version: '0.25.1',
    date: '2026-11-19',
    text: {
      sv: [
        "Rättat: V-inläggets plugg fräste inte bort instängda partier mellan bokstäver (t.ex. där serifer möts). De satt kvar i pluggen och hindrade den från att gå ner i fickan. Nu fräses allt innanför marginalen ner till pluggdjupet.",
        "Limma och plana räknar passningen på ett finare rutnät och låter enstaka hårfina spetsar ge efter, som när man pressar ihop inlägget.",
      ],
      en: [
        "Fixed: the V-inlay plug did not clear enclosed areas between letters (e.g. where serifs meet). They stayed on the plug and kept it from going into the pocket. Everything inside the margin is now milled down to the plug depth.",
        "Glue and plane computes the fit on a finer grid and lets single hair-thin tips give way, as when the inlay is clamped.",
      ],
      fr: [
        "Corrigé : le bouchon de l’incrustation en V n’évidait pas les zones enfermées entre les lettres (p. ex. là où les empattements se rejoignent). Elles restaient sur le bouchon et l’empêchaient d’entrer dans la poche. Tout ce qui est à l’intérieur de la marge est maintenant usiné à la profondeur du bouchon.",
        "Coller et raboter calcule l’ajustement sur une grille plus fine et laisse céder les pointes très fines isolées, comme lors du serrage.",
      ],
      de: [
        "Behoben: Der Stopfen der V-Intarsie räumte eingeschlossene Bereiche zwischen Buchstaben (z. B. wo Serifen sich treffen) nicht aus. Sie blieben am Stopfen und verhinderten, dass er in die Tasche ging. Jetzt wird alles innerhalb des Randes auf Stopfentiefe gefräst.",
        "Leimen und abrichten berechnet die Passung auf einem feineren Raster und lässt einzelne haarfeine Spitzen nachgeben, wie beim Verpressen.",
      ],
      es: [
        "Corregido: el tapón de la incrustación en V no vaciaba las zonas encerradas entre letras (p. ej. donde se juntan las serifas). Quedaban en el tapón e impedían que entrara en la cajera. Ahora todo lo que queda dentro del margen se fresa a la profundidad del tapón.",
        "Encolar y cepillar calcula el ajuste en una cuadrícula más fina y deja ceder puntas finísimas aisladas, como al prensar la incrustación.",
      ],
      pl: [
        "Poprawiono: wkładka intarsji V nie wybierała zamkniętych obszarów między literami (np. tam, gdzie stykają się szeryfy). Zostawały na wkładce i nie pozwalały jej wejść w kieszeń. Teraz wszystko w obrębie marginesu jest frezowane do głębokości wkładki.",
        "Klejenie i strugenie liczy pasowanie na drobniejszej siatce i pozwala ustąpić pojedynczym bardzo cienkim ostrzom, jak przy ściskaniu.",
      ],
      uk: [
        "Виправлено: вставка V-інкрустації не вибирала замкнені ділянки між літерами (напр. там, де сходяться засічки). Вони лишалися на вставці й не давали їй увійти в кишеню. Тепер усе всередині поля фрезерується до глибини вставки.",
        "«Склеїти й прострогати» рахує посадку на дрібнішій сітці й дозволяє поодиноким дуже тонким вістрям піддатися, як під час стискання.",
      ],
    },
  },
  {
    version: '0.25.0',
    date: '2026-11-19',
    text: {
      sv: [
        "V-inlägg simuleras nu som i verkligheten: pluggen fräses i ett eget inläggsträ bredvid grundträet, och Limma och plana vänder pluggen, trycker ner den i fickan och planar ytan – med passningskontroll som visar glipor och tunna partier.",
        "Pluggens G-kod har nu egen nollpunkt i inläggsträets nedre vänstra hörn, och inläggsträets minsta storlek står i G-koden och under Egenskaper. Välj träslag för inlägget – valnöt är nytt material och standard.",
      ],
      en: [
        "V-inlays are now simulated as in real life: the plug is milled in its own inlay wood next to the base, and Glue and plane flips the plug, presses it into the pocket and planes the surface – with a fit check showing gaps and thin areas.",
        "The plug G-code now has its own origin at the lower left corner of the inlay wood, and the minimum inlay wood size is written in the G-code and under Properties. Choose the wood for the inlay – walnut is a new material and the default.",
      ],
      fr: [
        "Les incrustations en V sont simulées comme en vrai : le bouchon est usiné dans son propre bois à côté du bois de base, et Coller et raboter retourne le bouchon, l’enfonce dans la poche et rabote la surface – avec un contrôle d’ajustement qui montre les jours et les zones minces.",
        "Le G-code du bouchon a maintenant sa propre origine au coin inférieur gauche du bois d’incrustation, et la taille minimale de ce bois est indiquée dans le G-code et sous Propriétés. Choisissez l’essence de l’incrustation – le noyer est un nouveau matériau et le choix par défaut.",
      ],
      de: [
        "V-Intarsien werden jetzt wie in echt simuliert: Der Stopfen wird in einem eigenen Intarsienholz neben dem Grundholz gefräst, und Leimen und abrichten dreht ihn, drückt ihn in die Tasche und hobelt die Oberfläche – mit Passungsprüfung, die Spalten und dünne Stellen zeigt.",
        "Der G-Code des Stopfens hat jetzt einen eigenen Nullpunkt an der unteren linken Ecke des Intarsienholzes, und dessen Mindestgröße steht im G-Code und unter Eigenschaften. Holzart der Intarsie wählbar – Nussbaum ist neues Material und Standard.",
      ],
      es: [
        "Las incrustaciones en V se simulan como en la realidad: el tapón se fresa en su propia madera junto a la base, y Encolar y cepillar le da la vuelta, lo encaja en la cajera y cepilla la superficie, con un control de ajuste que muestra huecos y zonas finas.",
        "El G-code del tapón tiene ahora su propio origen en la esquina inferior izquierda de la madera de incrustación, y su tamaño mínimo figura en el G-code y en Propiedades. Elija la madera de la incrustación: el nogal es un material nuevo y el predeterminado.",
      ],
      pl: [
        "Intarsje V są teraz symulowane jak w rzeczywistości: wkładka jest frezowana we własnym drewnie obok drewna bazowego, a Klejenie i strugenie odwraca ją, wciska w kieszeń i struga powierzchnię – z kontrolą pasowania pokazującą szczeliny i cienkie miejsca.",
        "G-code wkładki ma teraz własny punkt zerowy w lewym dolnym rogu drewna wkładki, a jego minimalny rozmiar podany jest w G-code i we Właściwościach. Wybierz gatunek drewna wkładki – orzech to nowy materiał i domyślny wybór.",
      ],
      uk: [
        "V-інкрустації тепер моделюються як насправді: вставка фрезерується у власній деревині поруч з основною, а «Склеїти й прострогати» перевертає її, вдавлює в кишеню й строгає поверхню – з перевіркою посадки, що показує щілини й тонкі місця.",
        "G-код вставки тепер має власний нуль у нижньому лівому куті деревини вставки, а її мінімальний розмір указано в G-коді та у Властивостях. Оберіть породу деревини вставки – горіх є новим матеріалом і типовим вибором.",
      ],
    },
  },
  {
    version: '0.24.0',
    date: '2026-11-16',
    text: {
      sv: ["Bild till relief har fått bump mapping: bildens fina detaljer läggs ovanpå reliefens utjämnade form, med inställbar styrka och detaljstorlek. Finns i dialogen och under Egenskaper."],
      en: ["Image to relief now has bump mapping: the image’s fine detail is laid on top of the smoothed relief shape, with adjustable strength and detail size. Available in the dialog and under Properties."],
      fr: ["Image vers relief propose maintenant le bump mapping : les détails fins de l’image s’ajoutent à la forme lissée du relief, avec intensité et taille des détails réglables. Dans la boîte de dialogue et sous Propriétés."],
      de: ["Bild zu Relief hat jetzt Bump-Mapping: Die feinen Details des Bildes werden auf die geglättete Reliefform gelegt, mit einstellbarer Stärke und Detailgröße. Im Dialog und unter Eigenschaften."],
      es: ["Imagen a relieve ahora tiene bump mapping: los detalles finos de la imagen se añaden sobre la forma suavizada del relieve, con intensidad y tamaño de detalle ajustables. En el diálogo y en Propiedades."],
      pl: ["Obraz na relief ma teraz bump mapping: drobne detale obrazu nakładane są na wygładzony kształt reliefu, z regulowaną siłą i wielkością detali. W oknie dialogowym i w Właściwościach."],
      uk: ["«Зображення в рельєф» тепер має bump mapping: дрібні деталі зображення накладаються на згладжену форму рельєфу, з налаштовуваною силою й розміром деталей. У діалозі та у Властивостях."],
    },
  },
  {
    version: '0.23.1',
    date: '2026-11-14',
    text: {
      sv: ["Feedback är nu aktiverad – skicka gärna synpunkter via pratbubblan uppe till höger."],
      en: ["Feedback is now enabled – send your thoughts via the speech bubble at the top right."],
      fr: ["Les avis sont maintenant activés – envoyez vos remarques via la bulle en haut à droite."],
      de: ["Feedback ist jetzt aktiviert – senden Sie Ihre Meinung über die Sprechblase oben rechts."],
      es: ["Los comentarios ya están activados: envíe sus opiniones con el bocadillo de arriba a la derecha."],
      pl: ["Opinie są już włączone – wyślij swoje uwagi przez dymek w prawym górnym rogu."],
      uk: ["Відгуки тепер увімкнено – надсилайте свої думки через хмарку вгорі праворуч."],
    },
  },
  {
    version: '0.23.0',
    date: '2026-11-14',
    text: {
      sv: [
        "Skicka feedback direkt från appen – knappen med pratbubblan uppe till höger eller i Om desktopCAM. Välj idé, fel eller övrigt, och ange e-post om du vill ha svar.",
      ],
      en: [
        "Send feedback straight from the app – the speech-bubble button at the top right or in About desktopCAM. Choose idea, bug or other, and enter your email if you want a reply.",
      ],
      fr: [
        "Envoyez un avis directement depuis l’application – le bouton bulle en haut à droite ou dans À propos de desktopCAM. Choisissez idée, bogue ou autre, et indiquez votre e-mail si vous souhaitez une réponse.",
      ],
      de: [
        "Feedback direkt aus der App senden – über die Sprechblase oben rechts oder in Über desktopCAM. Idee, Fehler oder Sonstiges wählen und bei Wunsch eine E-Mail für die Antwort angeben.",
      ],
      es: [
        "Envíe comentarios directamente desde la aplicación: el botón del bocadillo arriba a la derecha o en Acerca de desktopCAM. Elija idea, error u otro, e indique su correo si quiere respuesta.",
      ],
      pl: [
        "Wysyłaj opinie prosto z aplikacji – przycisk z dymkiem w prawym górnym rogu lub w O desktopCAM. Wybierz pomysł, błąd lub inne i podaj e-mail, jeśli chcesz odpowiedź.",
      ],
      uk: [
        "Надсилайте відгуки прямо з програми – кнопка з хмаркою вгорі праворуч або в «Про desktopCAM». Виберіть ідею, помилку чи інше та вкажіть e-mail, якщо хочете відповідь.",
      ],
    },
  },
  {
    version: '0.22.0',
    date: '2026-11-14',
    text: {
      sv: [
        "Ny operation: Planfräsning. Jämnar ämnets ovansida eller offerbordet i grunda, breda pass – välj hela ämnet eller markerade formers yta, djup, sidstegning, riktning och sicksack eller enkelriktat.",
        "Planfräsningen väljer automatiskt den grövsta pinnfräsen (t.ex. planfräsen 22 mm) och går ner utanför materialet för rena kanter.",
      ],
      en: [
        "New operation: Facing. Levels the top of the stock or the spoilboard in shallow, wide passes – choose the whole stock or the area of selected shapes, depth, stepover, direction and zigzag or one way.",
        "Facing automatically picks the largest end mill (e.g. the 22 mm surfacing bit) and plunges outside the material for clean edges.",
      ],
      fr: [
        "Nouvelle opération : Surfaçage. Met à niveau le dessus de la pièce ou le martyr en passes faibles et larges – choisissez toute la pièce ou la zone des formes sélectionnées, profondeur, pas latéral, direction et zigzag ou sens unique.",
        "Le surfaçage choisit automatiquement la plus grosse fraise (p. ex. la fraise à surfacer 22 mm) et plonge hors du matériau pour des bords nets.",
      ],
      de: [
        "Neue Operation: Planfräsen. Ebnet die Oberseite des Werkstücks oder die Opferplatte in flachen, breiten Bahnen – ganzes Werkstück oder Fläche ausgewählter Formen, Tiefe, Bahnüberlappung, Richtung sowie Zickzack oder einseitig.",
        "Planfräsen wählt automatisch den größten Schaftfräser (z. B. den 22-mm-Planfräser) und taucht außerhalb des Materials ein, für saubere Kanten.",
      ],
      es: [
        "Nueva operación: Planeado. Nivela la cara superior de la pieza o el tablero de sacrificio con pasadas finas y anchas: elija toda la pieza o el área de las formas seleccionadas, profundidad, paso lateral, dirección y zigzag o un sentido.",
        "El planeado elige automáticamente la fresa más grande (p. ej. la de planear de 22 mm) y baja fuera del material para dejar bordes limpios.",
      ],
      pl: [
        "Nowa operacja: Planowanie. Wyrównuje górę materiału lub stół ofiarny płytkimi, szerokimi przejściami – wybierz cały materiał lub obszar zaznaczonych kształtów, głębokość, krok boczny, kierunek oraz zygzak lub jednokierunkowo.",
        "Planowanie samo wybiera największy frez walcowy (np. frez do planowania 22 mm) i zagłębia się poza materiałem dla czystych krawędzi.",
      ],
      uk: [
        "Нова операція: фрезерування площини. Вирівнює верх заготовки або жертовний стіл неглибокими широкими проходами – виберіть усю заготовку або площу виділених фігур, глибину, боковий крок, напрямок і зигзаг або в один бік.",
        "Операція сама вибирає найбільшу кінцеву фрезу (напр. фрезу для площини 22 мм) і заглиблюється поза матеріалом для чистих країв.",
      ],
    },
  },
  {
    version: '0.21.1',
    date: '2026-11-14',
    text: {
      sv: [
        "Redigera verktyg öppnas direkt under verktyget i listan, så att du slipper leta längst ned.",
        "Längderna (skärlängd, total längd och utstick) går nu att ändra även i nybörjarläget – för borrar och alla fräsar.",
        "Nya ?-förklaringar med animerade bilder till Hackdjup och Spetsvinkel.",
      ],
      en: [
        "Edit tool now opens right below the tool in the list, so you no longer have to look at the bottom.",
        "The lengths (cutting length, overall length and stickout) can now be changed in beginner mode too – for drills and all cutters.",
        "New ? explanations with animated pictures for Peck depth and Point angle.",
      ],
      fr: [
        "Modifier l’outil s’ouvre maintenant juste sous l’outil dans la liste, plus besoin de chercher en bas.",
        "Les longueurs (longueur de coupe, longueur totale et dépassement) se modifient maintenant aussi en mode débutant – pour les forets et toutes les fraises.",
        "Nouvelles explications ? avec images animées pour Débourrage et Angle de pointe.",
      ],
      de: [
        "Werkzeug bearbeiten öffnet sich jetzt direkt unter dem Werkzeug in der Liste, statt ganz unten.",
        "Die Längen (Schneidenlänge, Gesamtlänge und Auskraglänge) lassen sich jetzt auch im Einsteigermodus ändern – für Bohrer und alle Fräser.",
        "Neue ?-Erklärungen mit animierten Bildern zu Zustelltiefe und Spitzenwinkel.",
      ],
      es: [
        "Editar herramienta se abre ahora justo debajo de la herramienta en la lista, sin tener que buscar al final.",
        "Las longitudes (longitud de corte, longitud total y voladizo) se pueden cambiar también en modo principiante, para brocas y todas las fresas.",
        "Nuevas explicaciones ? con imágenes animadas para Profundidad de picoteo y Ángulo de punta.",
      ],
      pl: [
        "Edycja narzędzia otwiera się teraz tuż pod narzędziem na liście, zamiast na samym dole.",
        "Długości (długość skrawająca, całkowita i wysięg) można teraz zmieniać także w trybie początkującym – dla wierteł i wszystkich frezów.",
        "Nowe objaśnienia ? z animowanymi obrazkami dla Głębokości kroku i Kąta wierzchołkowego.",
      ],
      uk: [
        "Редагування інструмента тепер відкривається одразу під інструментом у списку, а не в самому низу.",
        "Довжини (робоча, загальна та виліт) тепер можна змінювати й у режимі початківця – для свердел і всіх фрез.",
        "Нові пояснення ? з анімованими зображеннями для «Крок свердління» та «Кут при вершині».",
      ],
    },
  },
  {
    version: '0.21.0',
    date: '2026-11-14',
    text: {
      sv: [
        "Stjärnmärk dina favoritverktyg i verktygsbiblioteket – de visas överst i listorna Aktivt verktyg och Verktyg.",
        "Dra verktygen upp eller ned i verktygsbiblioteket för att ändra ordningen.",
        "Nya tips under verktygsbiblioteket visar vilka verktyg som passar vilka material. Tipset för det valda materialet markeras.",
      ],
      en: [
        "Star your favourite tools in the tool library – they appear at the top of the Active tool and Tool lists.",
        "Drag tools up or down in the tool library to change their order.",
        "New tips below the tool library show which tools suit which materials. The tip for the selected material is highlighted.",
      ],
      fr: [
        "Marquez vos outils favoris d’une étoile dans la bibliothèque – ils apparaissent en tête des listes Outil actif et Outil.",
        "Faites glisser les outils vers le haut ou le bas dans la bibliothèque pour changer leur ordre.",
        "De nouveaux conseils sous la bibliothèque indiquent quels outils conviennent à quels matériaux. Le conseil du matériau choisi est mis en évidence.",
      ],
      de: [
        "Markieren Sie Lieblingswerkzeuge in der Werkzeugbibliothek mit einem Stern – sie stehen oben in den Listen Aktives Werkzeug und Werkzeug.",
        "Ziehen Sie Werkzeuge in der Bibliothek nach oben oder unten, um die Reihenfolge zu ändern.",
        "Neue Tipps unter der Werkzeugbibliothek zeigen, welche Werkzeuge zu welchen Materialien passen. Der Tipp zum gewählten Material ist hervorgehoben.",
      ],
      es: [
        "Marque sus herramientas favoritas con una estrella en la biblioteca: aparecen arriba en las listas Herramienta activa y Herramienta.",
        "Arrastre las herramientas hacia arriba o abajo en la biblioteca para cambiar su orden.",
        "Nuevos consejos bajo la biblioteca de herramientas indican qué herramientas sirven para qué materiales. Se resalta el consejo del material elegido.",
      ],
      pl: [
        "Oznaczaj ulubione narzędzia gwiazdką w bibliotece – pojawiają się na górze list Aktywne narzędzie i Narzędzie.",
        "Przeciągaj narzędzia w górę lub w dół w bibliotece, aby zmienić ich kolejność.",
        "Nowe wskazówki pod biblioteką narzędzi pokazują, które narzędzia pasują do jakich materiałów. Wskazówka dla wybranego materiału jest wyróżniona.",
      ],
      uk: [
        "Позначайте улюблені інструменти зіркою в бібліотеці – вони з’являються вгорі списків «Активний інструмент» та «Інструмент».",
        "Перетягуйте інструменти вгору чи вниз у бібліотеці, щоб змінити їхній порядок.",
        "Нові поради під бібліотекою інструментів показують, які інструменти підходять для яких матеріалів. Порада для вибраного матеріалу виділена.",
      ],
    },
  },
  {
    version: '0.20.0',
    date: '2026-11-14',
    text: {
      sv: [
        'Verktygsbiblioteket har 20 nya verktyg: pinnfräsar 1–8 mm, nedskärande fräs, planfräs 22 mm, kulfräsar 1–6 mm, V-fräsar 30°, 60° och 120°, och borrar 1,5–8 mm.',
        'Borrning har egna riktvärden: nedmatningen räknas som matning per varv × varvtal för materialet och borrens diameter, och pickdjupet efter materialet. Rätt borr väljs efter hålens storlek, och genomgående hål får borrspetsens längd tillagd.',
        'Rättat: nedmatningen begränsades av sidmatningen – nu av maskinens Z-hastighet. V-fräsar får inte längre för hög matning på grund av sin stora diameter. Byter du verktyg i en bana uppdateras matning, nedmatning och varvtal.',
      ],
      en: [
        'The tool library has 20 new tools: end mills 1–8 mm, a down-cut bit, a 22 mm surfacing bit, ball noses 1–6 mm, V-bits 30°, 60° and 120°, and drills 1.5–8 mm.',
        'Drilling has its own guide values: the plunge rate is feed per revolution × speed for the material and drill diameter, and the peck depth follows the material. The right drill is chosen from the hole size, and through holes get the drill point length added.',
        'Fixed: the plunge rate was limited by the sideways feed – now by the machine’s Z speed. V-bits no longer get too high a feed because of their large diameter. Changing the tool of a toolpath updates feed, plunge and spindle speed.',
      ],
      fr: [
        'La bibliothèque d’outils compte 20 nouveaux outils : fraises droites 1–8 mm, fraise à coupe descendante, fraise à surfacer 22 mm, fraises boules 1–6 mm, fraises en V 30°, 60° et 120°, et forets 1,5–8 mm.',
        'Le perçage a ses propres valeurs : vitesse de plongée = avance par tour × vitesse selon le matériau et le diamètre, et débourrage selon le matériau. Le foret est choisi selon la taille des trous, et les trous débouchants intègrent la longueur de la pointe.',
        'Corrigé : la plongée était limitée par l’avance latérale – maintenant par la vitesse de l’axe Z. Les fraises en V n’ont plus une avance trop élevée à cause de leur grand diamètre. Changer d’outil met à jour avance, plongée et vitesse.',
      ],
      de: [
        'Die Werkzeugbibliothek hat 20 neue Werkzeuge: Schaftfräser 1–8 mm, einen Abwärtsschneider, einen Planfräser 22 mm, Kugelfräser 1–6 mm, V-Fräser 30°, 60° und 120° sowie Bohrer 1,5–8 mm.',
        'Bohren hat eigene Richtwerte: Eintauchvorschub = Vorschub pro Umdrehung × Drehzahl für Material und Bohrerdurchmesser, die Zustelltiefe richtet sich nach dem Material. Der passende Bohrer wird nach Lochgröße gewählt, und Durchgangslöcher bekommen die Länge der Bohrerspitze dazu.',
        'Behoben: Der Eintauchvorschub war durch den seitlichen Vorschub begrenzt – jetzt durch die Z-Geschwindigkeit der Maschine. V-Fräser bekommen wegen ihres großen Durchmessers keinen zu hohen Vorschub mehr. Beim Werkzeugwechsel einer Bahn werden Vorschub, Eintauchen und Drehzahl aktualisiert.',
      ],
      es: [
        'La biblioteca de herramientas tiene 20 herramientas nuevas: fresas planas de 1–8 mm, una fresa de corte descendente, una fresa de planear de 22 mm, fresas de bola de 1–6 mm, fresas en V de 30°, 60° y 120°, y brocas de 1,5–8 mm.',
        'El taladrado tiene valores propios: la penetración es avance por vuelta × revoluciones según el material y el diámetro, y el picoteo depende del material. La broca se elige según el tamaño de los agujeros y los pasantes suman la longitud de la punta.',
        'Corregido: la penetración estaba limitada por el avance lateral; ahora por la velocidad del eje Z. Las fresas en V ya no reciben un avance excesivo por su gran diámetro. Al cambiar la herramienta de una trayectoria se actualizan avance, penetración y revoluciones.',
      ],
      pl: [
        'Biblioteka narzędzi ma 20 nowych narzędzi: frezy walcowe 1–8 mm, frez ze spiralą w dół, frez do planowania 22 mm, frezy kulowe 1–6 mm, frezy V 30°, 60° i 120° oraz wiertła 1,5–8 mm.',
        'Wiercenie ma własne wartości: posuw wgłębny = posuw na obrót × obroty dla materiału i średnicy wiertła, a głębokość kroku zależy od materiału. Wiertło jest dobierane do wielkości otworów, a otwory przelotowe uwzględniają długość wierzchołka.',
        'Poprawiono: posuw wgłębny był ograniczany posuwem bocznym – teraz prędkością osi Z. Frezy V nie dostają już zbyt dużego posuwu przez dużą średnicę. Zmiana narzędzia w ścieżce aktualizuje posuw, wgłębianie i obroty.',
      ],
      uk: [
        'У бібліотеці інструментів 20 нових: прямі фрези 1–8 мм, низхідна фреза, фреза для вирівнювання 22 мм, сферичні фрези 1–6 мм, V-фрези 30°, 60° і 120° та свердла 1,5–8 мм.',
        'Свердління має власні значення: подача врізання = подача на оберт × оберти для матеріалу й діаметра свердла, крок залежить від матеріалу. Свердло обирається за розміром отворів, а для наскрізних додається довжина вершини.',
        'Виправлено: подачу врізання обмежувала бічна подача – тепер швидкість осі Z. V-фрези більше не отримують завелику подачу через великий діаметр. Зміна інструмента в траєкторії оновлює подачу, врізання й оберти.',
      ],
    },
  },
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
      sv: ['Placera flikar själv i vyn. Rättat: finpasset fräste bort flikarna.'],
      en: ['Place tabs yourself in the view. Fixed: the finishing pass cut away the tabs.'],
      fr: ['Placez vous-même les attaches dans la vue. Corrigé : la passe de finition coupait les attaches.'],
      de: ['Haltestege selbst in der Ansicht setzen. Behoben: Der Schlichtgang fräste die Haltestege weg.'],
      es: ['Coloca tú mismo las pestañas en la vista. Corregido: la pasada de acabado cortaba las pestañas.'],
      pl: ['Umieszczaj mostki samodzielnie w widoku. Poprawiono: przejście wykańczające wycinało mostki.'],
      uk: ['Розміщуйте перемички самі у виді. Виправлено: чистовий прохід вирізав перемички.'],
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

export { APP_VERSION } from './version';
