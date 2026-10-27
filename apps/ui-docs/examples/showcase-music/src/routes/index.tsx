// Rivet-authored showcase (own content: invented artists and albums; covers are AI-generated sample images; no audio plays).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
import { Sidebar } from "@rivetjs/ui/sidebar";
import { Slider } from "@rivetjs/ui/slider";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { Compass, Heart, House, ListMusic, Pause, Play, Radio, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide";

import tideCover from "../assets/cover-tide.jpg?image";
import emberCover from "../assets/cover-ember.jpg?image";
import pineCover from "../assets/cover-pine.jpg?image";
import neonCover from "../assets/cover-neon.jpg?image";
import duneCover from "../assets/cover-dune.jpg?image";
import bloomCover from "../assets/cover-bloom.jpg?image";

export const head = { title: "Showcase: Music" };

// #region demo
type Track = { title: string; seconds: number };
type Row = { id: string; key: string; album: string; index: number; title: string; seconds: number };
type Album = { id: string; title: string; artist: string; year: number; cover: typeof tideCover; tracks: Track[] };

const ALBUMS: Album[] = [
  {
    id: "low-tide",
    title: "Low Tide Hours",
    artist: "Marisol Vey",
    year: 2025,
    cover: tideCover,
    tracks: [
      { title: "Harbour Lights", seconds: 214 },
      { title: "Salt in the Radio", seconds: 187 },
      { title: "Slow Ferry", seconds: 243 },
      { title: "Shoreline Static", seconds: 198 },
      { title: "Blue Hour", seconds: 256 },
    ],
  },
  {
    id: "ember",
    title: "Ember Season",
    artist: "The Quiet Arcades",
    year: 2024,
    cover: emberCover,
    tracks: [
      { title: "Kindling", seconds: 176 },
      { title: "Red Kite", seconds: 221 },
      { title: "After the Bonfire", seconds: 265 },
      { title: "Warm Front", seconds: 192 },
    ],
  },
  {
    id: "pine",
    title: "Under Pine",
    artist: "Odile Faro",
    year: 2023,
    cover: pineCover,
    tracks: [
      { title: "Needles", seconds: 158 },
      { title: "Cabin Fever Dream", seconds: 233 },
      { title: "Moss", seconds: 201 },
      { title: "Trailhead", seconds: 247 },
    ],
  },
  {
    id: "neon",
    title: "Neon Commute",
    artist: "Lumen Park",
    year: 2025,
    cover: neonCover,
    tracks: [
      { title: "Night Bus", seconds: 205 },
      { title: "Platform 9", seconds: 189 },
      { title: "Rain on Glass", seconds: 238 },
    ],
  },
  {
    id: "dune",
    title: "Dune Letters",
    artist: "Sami Okafor",
    year: 2022,
    cover: duneCover,
    tracks: [
      { title: "Postcard from the Erg", seconds: 226 },
      { title: "Heat Shimmer", seconds: 182 },
      { title: "Caravan", seconds: 274 },
    ],
  },
  {
    id: "bloom",
    title: "Late Bloom",
    artist: "Ines Halloran",
    year: 2024,
    cover: bloomCover,
    tracks: [
      { title: "Petals", seconds: 167 },
      { title: "Greenhouse", seconds: 213 },
      { title: "April Again", seconds: 239 },
    ],
  },
];

const PLAYLISTS = ["Morning run", "Deep focus", "Sunday kitchen", "Road trip 2026", "Rainy commute"];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function MusicShowcase() {
  const albumId = signal("low-tide");
  const playing = signal({ album: "low-tide", index: 0 });
  const position = signal(42);
  const isPlaying = signal(false);
  const timer = signal(0);
  const volume = signal(70);
  const shuffle = signal(false);
  const repeat = signal(false);
  const liked = signal<string[]>(["low-tide-2"]);

  const albumOf = (id: string) => ALBUMS.find((a) => a.id === id)!;
  const album = () => albumOf(albumId());
  const rows = () =>
    album().tracks.map((t, index): Row => ({
      id: `${album().id}-${index}`,
      key: `${album().id}-${index}`,
      album: album().id,
      index,
      title: t.title,
      seconds: t.seconds,
    }));
  const current = () => albumOf(playing().album);
  const track = () => current().tracks[playing().index];

  const stop = () => {
    clearInterval(timer());
    isPlaying.set(false);
  };
  const skip = (step: number) => {
    const list = current().tracks;
    const p = playing();
    const next = shuffle() ? Math.floor(Math.random() * list.length) : p.index + step;
    if (next >= list.length && !repeat()) return stop();
    playing.set({ album: p.album, index: (next + list.length) % list.length });
    position.set(0);
  };
  const start = () => {
    clearInterval(timer());
    isPlaying.set(true);
    timer.set(
      setInterval(() => {
        if (position() + 1 >= track().seconds) skip(1);
        else position.set(position() + 1);
      }, 1000) as unknown as number,
    );
  };
  const playAt = (id: string, index: number) => {
    playing.set({ album: id, index });
    position.set(0);
    start();
  };
  const setLike = (key: string, on: boolean) => liked.set(on ? [...liked().filter((k) => k !== key), key] : liked().filter((k) => k !== key));
  const isCurrent = (row: Row) => playing().album === row.album && playing().index === row.index;

  return (
    <div class="grid h-dvh grid-rows-[1fr_auto] overflow-hidden">
      {/* The library sidebar lives in the top row (`contained`): an icon rail when collapsed, a sheet below 768 px. */}
      <Sidebar.Provider contained class="min-h-0">
        <Sidebar id="library" collapsible="icon" aria-label="Library">
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton href="#listen" isCurrent tooltip="Listen now">
                    <Icon icon={House} size={16} />
                    <span>Listen now</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton href="#listen" tooltip="Browse">
                    <Icon icon={Compass} size={16} />
                    <span>Browse</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton href="#listen" tooltip="Radio">
                    <Icon icon={Radio} size={16} />
                    <span>Radio</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.Group>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Playlists</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {PLAYLISTS.map((name) => (
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#listen" tooltip={name}>
                      <Icon icon={ListMusic} size={16} />
                      <span>{name}</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Rail />
        </Sidebar>

        <Sidebar.Inset class="min-w-0">
          <main id="listen" class="flex h-full min-w-0 flex-col gap-8 overflow-y-auto p-4 sm:p-8">
            <section aria-labelledby="made-for-you" class="flex flex-col gap-3">
              <div class="flex items-start gap-2">
                <Sidebar.Trigger id="library-toggle" aria-label="Toggle library" class="-ms-1 mt-0.5" />
                <div>
                  <h1 id="made-for-you" class="text-2xl font-semibold">
                    Listen now
                  </h1>
                  <p class="text-sm text-muted">Albums picked from what you played this week.</p>
                </div>
              </div>
              {/* The row scrolls on its own (edge shadows while there is more); the page never scrolls sideways. */}
              <ScrollShadow orientation="horizontal" class="-mx-4 sm:-mx-1">
                <ul class="flex snap-x scroll-px-4 gap-4 px-4 pt-1 pb-2 sm:scroll-px-1 sm:px-1">
                  {ALBUMS.map((a) => (
                    <li class="w-36 shrink-0 snap-start sm:w-40">
                      <Card variant="transparent" class="album-card relative gap-2 p-0">
                        <span class="album-card__cover overflow-hidden rounded-2xl">
                          <Picture image={a.cover} alt="" sizes="10rem" class="aspect-square w-full object-cover transition-transform" />
                        </span>
                        <Card.Header class="gap-0">
                          <Card.Title class="truncate text-sm">{a.title}</Card.Title>
                          <Card.Description class="truncate text-xs">{a.artist}</Card.Description>
                        </Card.Header>
                        {/* The press target covers the card (stretched toggle): one tab stop, pressed = the open album. */}
                        <ToggleButton
                          id={`album-${a.id}`}
                          variant="ghost"
                          aria-label={`${a.title} by ${a.artist}`}
                          isSelected={albumId() === a.id}
                          onChange={() => albumId.set(a.id)}
                          class="album-card__press"
                        />
                      </Card>
                    </li>
                  ))}
                </ul>
              </ScrollShadow>
            </section>

            {/* The picked album's page: its texts update in place, the track rows are one keyed collection (a new album swaps every row). */}
            <section id="album-page" aria-label={album().title} class="flex flex-col gap-4">
              <div class="flex items-end gap-4">
                <Picture image={album().cover} alt="" sizes="10rem" class="size-24 shrink-0 rounded-2xl object-cover shadow-surface sm:size-40" />
                <div class="flex min-w-0 flex-col gap-2">
                  <p class="text-xs font-medium tracking-wide text-muted uppercase">Album</p>
                  <h2 class="album-title text-2xl font-semibold">{album().title}</h2>
                  <p class="text-sm text-muted">
                    {album().artist} · {album().year} · {album().tracks.length} songs
                  </p>
                  <div class="flex gap-2">
                    <Button id="play-album" onPress={() => playAt(albumId(), 0)}>
                      <Icon icon={Play} size={16} />
                      Play
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        shuffle.set(true);
                        playAt(albumId(), Math.floor(Math.random() * album().tracks.length));
                      }}
                    >
                      <Icon icon={Shuffle} size={16} />
                      Shuffle
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tracks: an interactive ItemCardGroup (arrow keys between rows; Enter / click plays; the like toggle is its own tab stop). */}
              <ItemCardGroupCollection
                id="album-tracks"
                aria-label={`${album().title} tracks`}
                variant="transparent"
                items={rows}
                onAction={(key) => {
                  const row = rows().find((r) => r.key === key);
                  if (row) playAt(row.album, row.index);
                }}
              >
                {(row: Row) => (
                  <ItemCard id={row.key} textValue={row.title} isCurrent={isCurrent(row)} class="music-track py-1.5">
                    <span class="w-5 text-right text-xs text-muted tabular-nums">{row.index + 1}</span>
                    <ItemCard.Content>
                      <ItemCard.Title>{row.title}</ItemCard.Title>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <span class="text-xs text-muted tabular-nums">{clock(row.seconds)}</span>
                      <ToggleButton
                        id={`like-${row.key}`}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`Like ${row.title}`}
                        isSelected={liked().includes(row.key)}
                        onChange={(on: boolean) => setLike(row.key, on)}
                        class="music-like"
                      >
                        <Icon icon={Heart} size={16} />
                      </ToggleButton>
                    </ItemCard.Action>
                  </ItemCard>
                )}
              </ItemCardGroupCollection>
            </section>
          </main>
        </Sidebar.Inset>
      </Sidebar.Provider>

      <footer aria-label="Player" class="flex flex-col gap-2 border-t border-separator bg-surface px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <Picture image={current().cover} alt="" sizes="3rem" class="size-12 shrink-0 rounded-xl object-cover" />
          <div class="flex min-w-0 flex-1 flex-col md:flex-none md:basis-56">
            <span id="now-title" class="truncate text-sm font-medium">
              {track().title}
            </span>
            <span class="truncate text-xs text-muted">{current().artist}</span>
          </div>

          <div class="flex flex-1 items-center justify-end gap-1 md:justify-center">
            <ToggleButton isIconOnly size="sm" variant="ghost" aria-label="Shuffle" isSelected={shuffle} class="hidden sm:inline-flex">
              <Icon icon={Shuffle} size={16} />
            </ToggleButton>
            <Button id="prev" isIconOnly size="sm" variant="ghost" aria-label="Previous song" onPress={() => skip(-1)} class="hidden sm:inline-flex">
              <Icon icon={SkipBack} size={18} />
            </Button>
            <Button id="play" isIconOnly aria-label={isPlaying() ? "Pause" : "Play"} onPress={() => (isPlaying() ? stop() : start())}>
              <Icon icon={isPlaying() ? Pause : Play} size={18} />
            </Button>
            <Button id="next" isIconOnly size="sm" variant="ghost" aria-label="Next song" onPress={() => skip(1)}>
              <Icon icon={SkipForward} size={18} />
            </Button>
            <ToggleButton isIconOnly size="sm" variant="ghost" aria-label="Repeat" isSelected={repeat} class="hidden sm:inline-flex">
              <Icon icon={Repeat} size={16} />
            </ToggleButton>
          </div>

          <div class="hidden w-40 items-center gap-2 lg:flex">
            <Icon icon={Volume2} size={16} class="shrink-0 text-muted" />
            <Slider aria-label="Volume" value={volume} class="w-full">
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs text-muted tabular-nums">
          <span id="elapsed" class="w-9 text-right">
            {clock(position())}
          </span>
          <Slider aria-label="Position" value={position} minValue={0} maxValue={track().seconds} class="flex-1">
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <span class="w-9">{clock(track().seconds)}</span>
        </div>
        <p id="player-status" role="status" class="sr-only">
          {isPlaying() ? `Playing ${track().title} by ${current().artist}` : "Paused"}
        </p>
      </footer>
    </div>
  );
}
// #endregion
