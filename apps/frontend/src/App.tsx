import { BulkTrashDialog } from './BulkTrashDialog';
import { BulkAlbumDialog } from './BulkAlbumDialog';
import { AlbumEditor } from './AlbumEditor';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  MemoryRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  Images,
  Heart,
  FolderHeart,
  Trash2,
  Cloud,
  Plus,
  ArrowUp,
  Check,
  ArrowLeft,
  ArrowRight,
  Download,
  Info,
  X,
  LayoutGrid,
  Grid2X2,
  ImagePlus,
  RotateCcw,
  LoaderCircle,
  ChevronRight,
  Menu,
  Sun,
  AlertCircle,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';
import { api } from './lib/api';
import type { components } from './lib/api.generated';
type Photo = components['schemas']['Photo'];

const navigation = [
  { to: '/', label: 'フォト', icon: Images },
  { to: '/favorites', label: 'お気に入り', icon: Heart },
  { to: '/albums', label: 'アルバム', icon: FolderHeart },
];
export function App({
  initialPath = '/',
  initialUploadOpen = false,
}: {
  initialPath?: string;
  initialUploadOpen?: boolean;
}) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <PhotoApp initialUploadOpen={initialUploadOpen} />
    </MemoryRouter>
  );
}
function PhotoApp({ initialUploadOpen }: { initialUploadOpen: boolean }) {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const formatMessage = 'JPEG・PNG・WebPの静止画像を選んでください';
  const [photos, setPhotos] = useState<Photo[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [compact, setCompact] = useState(false),
    [upload, setUpload] = useState(initialUploadOpen),
    [uploading, setUploading] = useState(false),
    [deletePhoto, setDeletePhoto] = useState<Photo | null>(null),
    [albumModal, setAlbumModal] = useState(false),
    [albumName, setAlbumName] = useState(''),
    [newAlbums, setNewAlbums] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [bulkAlbumOpen, setBulkAlbumOpen] = useState(false),
    [bulkTrashOpen, setBulkTrashOpen] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [filter, setFilter] = useState('すべて'),
    [showInfo, setShowInfo] = useState(false),
    [displayName, setDisplayName] = useState(''),
    [editingAlbumPhoto, setEditingAlbumPhoto] = useState<Photo | null>(null),
    [albumEditorOpen, setAlbumEditorOpen] = useState(false);
  const navigate = useNavigate(),
    location = useLocation(),
    fileInput = useRef<HTMLInputElement>(null);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [savedPhotos, albums, me] = await Promise.all([
        api.list(),
        api.albums(),
        api.me(),
      ]);
      setPhotos(savedPhotos);
      setNewAlbums(albums);
      setDisplayName(me.displayName);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setSelected([]);
    setMobileMenu(false);
    setFilter('すべて');
    setShowInfo(false);
    setAlbumEditorOpen(false);
    setEditingAlbumPhoto(null);
  }, [location.pathname]);
  async function update(photo: Photo, body: Parameters<typeof api.update>[1]) {
    try {
      const result = await api.update(photo.id, body);
      setPhotos((prev) => prev.map((p) => (p.id === result.id ? result : p)));
      return true;
    } catch {
      toast.error('変更を保存できませんでした');
      return false;
    }
  }
  async function toggleFavorite(photo: Photo) {
    if (await update(photo, { favorite: !photo.favorite }))
      toast.success(
        photo.favorite
          ? 'お気に入りから外しました'
          : 'お気に入りに追加しました',
      );
  }
  async function remove() {
    if (deletePhoto && (await update(deletePhoto, { deleted: true }))) {
      toast.success('ゴミ箱に移動しました');
      setDeletePhoto(null);
      if (location.pathname.startsWith('/photo/')) navigate('/');
    }
  }
  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!acceptedTypes.includes(file.type)) throw new Error(formatMessage);
        if (file.size > 50 * 1024 * 1024)
          throw new Error('1枚50MB以下の画像を選んでください');
        const photo = await api.create(file);
        setPhotos((prev) => [photo, ...prev]);
      }
      setUpload(false);
      navigate('/');
      toast.success(`${files.length}枚の写真を追加しました`);
    } catch (e) {
      toast.error((e as Error).message || '追加に失敗しました');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }
  const active = photos.filter((p) => !p.deleted),
    albumNames = [
      ...new Set([...photos.flatMap((p) => p.albums), ...newAlbums]),
    ];
  const isTrash = location.pathname === '/trash',
    isFavorite = location.pathname === '/favorites',
    isAlbums = location.pathname === '/albums';
  const title = isTrash
    ? 'ゴミ箱'
    : isFavorite
      ? 'お気に入り'
      : isAlbums
        ? 'アルバム'
        : 'フォト';
  function Gallery({ album }: { album?: string }) {
    const base = photos.filter((p) =>
      isTrash
        ? p.deleted
        : !p.deleted &&
          (!isFavorite || p.favorite) &&
          (!album || p.albums.includes(album)),
    );
    const visible = base.filter((p) => filter !== 'お気に入り' || p.favorite);
    const dates = [...new Set(visible.map((p) => p.date))].sort().reverse();
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR SHARED LIBRARY</div>
            <h1>
              {album || title}
              {isFavorite && <Heart className="heading-heart" size={23} />}
            </h1>
            <p>
              {isTrash
                ? '削除した写真を確認・復元できます'
                : isFavorite
                  ? '何度でも見返したい、大切な一枚。'
                  : album
                    ? 'ふたりで集めた、とっておきの瞬間。'
                    : '何気ない毎日も、とっておきの思い出に。'}
            </p>
          </div>
          <div className="heading-tools">
            <span className="photo-count">{base.length}枚の写真</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={compact ? '写真を大きく表示' : '写真を小さく表示'}
              onClick={() => setCompact(!compact)}
            >
              {compact ? <Grid2X2 size={20} /> : <LayoutGrid size={20} />}
            </Button>
          </div>
        </div>
        {!isTrash && !isFavorite && !album && active.length > 0 && (
          <div className="memories">
            <button
              className="memory memory-wide"
              onClick={() => navigate('/photo/' + active[0]?.id)}
            >
              <img src={active[0]?.src} alt={active[0]?.name} />
              <div className="memory-shade" />
              <span className="memory-tag">
                <Sun size={14} /> MOMENTS TO REMEMBER
              </span>
              <div className="memory-copy">
                <span>ふたりの、写真の記録</span>
                <p>共有した写真を見返そう。</p>
              </div>
              <span className="memory-arrow">
                <ArrowRight size={20} />
              </span>
            </button>
            <button className="memory" onClick={() => navigate('/favorites')}>
              <img
                src={(active.find((p) => p.favorite) ?? active[0])?.src}
                alt="お気に入りの写真"
              />
              <div className="memory-shade" />
              <span className="memory-tag">
                <Heart size={14} /> YOUR FAVORITES
              </span>
              <div className="memory-copy">
                <span>好きが集まる場所</span>
                <p>大切な瞬間を、もう一度。</p>
              </div>
              <span className="memory-arrow">
                <ArrowRight size={20} />
              </span>
            </button>
            <button className="memory" onClick={() => navigate('/albums')}>
              <img src={(active[2] ?? active[0])?.src} alt="共有した写真" />
              <div className="memory-shade" />
              <span className="memory-tag">A LITTLE ESCAPE</span>
              <div className="memory-copy">
                <span>思い出のアルバム</span>
                <p>写真をまとめて残そう。</p>
              </div>
              <span className="memory-arrow">
                <ArrowRight size={20} />
              </span>
            </button>
          </div>
        )}
        <div className="gallery-toolbar">
          <div className="chip-group">
            <button
              className={filter === 'すべて' ? 'chip active' : 'chip'}
              onClick={() => setFilter('すべて')}
            >
              すべての写真
            </button>
            {!isTrash && !isFavorite && (
              <button
                className={filter === 'お気に入り' ? 'chip active' : 'chip'}
                onClick={() => setFilter('お気に入り')}
              >
                <Heart size={14} />
                お気に入り
              </button>
            )}
          </div>
          <span className="sort-label">
            <ArrowUp size={14} />
            追加日の新しい順（UTC）
          </span>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar">
            {!isTrash && (
              <Button
                className="bulk-trash-trigger"
                variant="ghost"
                size="icon"
                aria-label="ゴミ箱に移動"
                title="ゴミ箱に移動"
                onClick={() => setBulkTrashOpen(true)}
              >
                <Trash2 size={18} />
              </Button>
            )}
            <div className="selection-summary">
              <Button
                variant="ghost"
                size="icon"
                aria-label="選択解除"
                onClick={() => setSelected([])}
              >
                <X size={18} />
              </Button>
              <strong>{selected.length}枚を選択中</strong>
            </div>
            <div className="selection-actions">
              {!isTrash && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkAlbumOpen(true)}
                >
                  <FolderHeart size={16} />
                  アルバムに追加
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const failed: string[] = [];
                  for (const p of photos.filter((p) => selected.includes(p.id)))
                    if (!(await update(p, { favorite: true })))
                      failed.push(p.id);
                  setSelected(failed);
                  if (!failed.length) toast.success('お気に入りに追加しました');
                }}
              >
                <Heart size={16} />
                お気に入りに追加
              </Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="empty-state">
            <LoaderCircle className="animate-spin" />
            <h2>写真を読み込んでいます</h2>
          </div>
        ) : error ? (
          <div className="empty-state">
            <AlertCircle size={38} />
            <h2>写真を読み込めませんでした</h2>
            <p>{error}</p>
            <Button onClick={load}>もう一度試す</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <Images size={44} />
            <h2>{isTrash ? 'ゴミ箱は空です' : 'まだ写真がありません'}</h2>
            <p>思い出の一枚から、はじめましょう。</p>
            {!isTrash && (
              <Button onClick={() => setUpload(true)}>
                <Plus size={16} />
                写真を追加
              </Button>
            )}
          </div>
        ) : (
          dates.map((date) => (
            <section className="date-section" key={date}>
              <div className="date-heading">
                <h2>
                  {new Intl.DateTimeFormat('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    timeZone: 'Asia/Tokyo',
                  }).format(new Date(date + 'T12:00:00+09:00'))}
                </h2>
                <span>{visible.find((p) => p.date === date)?.location}</span>
                <span className="date-line" />
                <span>{visible.filter((p) => p.date === date).length}枚</span>
              </div>
              <div className={`photo-grid ${compact ? 'compact' : ''}`}>
                {visible
                  .filter((p) => p.date === date)
                  .map((photo) => (
                    <div
                      key={photo.id}
                      className={`photo-tile ${selected.includes(photo.id) ? 'selected' : ''}`}
                    >
                      <button
                        className="photo-open"
                        onClick={() => navigate('/photo/' + photo.id)}
                        aria-label={`${photo.name}を開く`}
                      >
                        <img loading="lazy" src={photo.src} alt={photo.name} />
                        <span className="tile-shade" />
                        <span className="tile-name">{photo.name}</span>
                      </button>
                      <button
                        className="photo-select"
                        aria-label={`${photo.name}を選択`}
                        aria-pressed={selected.includes(photo.id)}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(photo.id)
                              ? prev.filter((id) => id !== photo.id)
                              : [...prev, photo.id],
                          )
                        }
                      >
                        <Check size={14} />
                      </button>
                      {photo.favorite && (
                        <Heart className="tile-heart" size={17} fill="white" />
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))
        )}
        <div className="library-footer">
          <span className="footer-mark">
            <Sun size={14} />
          </span>{' '}
          ふたりの思い出を、ここに。
        </div>
      </>
    );
  }
  function Detail() {
    const { id } = useParams();
    const photo = photos.find((p) => p.id === id);
    const siblings = photos.filter((p) => p.deleted === photo?.deleted);
    const index = siblings.findIndex((p) => p.id === id);
    const previous = siblings[index - 1];
    const next = siblings[index + 1];
    useEffect(() => {
      function key(e: KeyboardEvent) {
        if (albumEditorOpen || e.defaultPrevented) return;
        if (e.key === 'Escape') navigate(photo?.deleted ? '/trash' : '/');
        if (e.key === 'ArrowRight' && next) navigate('/photo/' + next.id);
        if (e.key === 'ArrowLeft' && previous)
          navigate('/photo/' + previous.id);
      }
      window.addEventListener('keydown', key);
      return () => window.removeEventListener('keydown', key);
    }, [id, index]);
    if (loading)
      return (
        <div className="empty-state">
          <LoaderCircle className="animate-spin" />
        </div>
      );
    if (!photo)
      return (
        <div className="empty-state">
          <h2>写真が見つかりません</h2>
          <Button onClick={() => navigate('/')}>フォトに戻る</Button>
        </div>
      );
    return (
      <div className="detail">
        <div className="detail-toolbar">
          <Button
            variant="ghost"
            onClick={() => navigate(photo.deleted ? '/trash' : '/')}
          >
            <ArrowLeft size={20} />
            戻る
          </Button>
          <span>
            {index + 1} / {siblings.length}
          </span>
          <div className="detail-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="お気に入りを切り替え"
              onClick={() => toggleFavorite(photo)}
            >
              <Heart
                size={20}
                fill={photo.favorite ? '#ef6779' : 'none'}
                color={photo.favorite ? '#ef6779' : 'currentColor'}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="ダウンロード"
              asChild
            >
              <a href={photo.originalUrl} download={photo.name}>
                <Download size={20} />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="アルバムに追加・解除"
              title="アルバムに追加・解除"
              data-album-editor-trigger
              onClick={() => {
                setEditingAlbumPhoto(photo);
                setAlbumEditorOpen(!albumEditorOpen);
                setShowInfo(false);
              }}
            >
              <FolderHeart size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="写真の情報"
              onClick={() => {
                setShowInfo(!showInfo);
                setAlbumEditorOpen(false);
              }}
            >
              <Info size={20} />
            </Button>
            {photo.deleted ? (
              <Button
                variant="secondary"
                aria-label="復元"
                title="復元"
                onClick={async () => {
                  if (await update(photo, { deleted: false })) {
                    toast.success('写真を復元しました');
                    navigate('/trash');
                  }
                }}
              >
                <RotateCcw size={16} />
                <span className="detail-action-label">復元</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="写真を削除"
                onClick={() => setDeletePhoto(photo)}
              >
                <Trash2 size={20} />
              </Button>
            )}
          </div>
        </div>
        <div className="detail-stage">
          <Button
            className="previous-photo"
            variant="outline"
            size="icon"
            aria-label="前の写真"
            disabled={index === 0}
            onClick={() => previous && navigate('/photo/' + previous.id)}
          >
            <ArrowLeft size={20} />
          </Button>
          <img className="detail-image" src={photo.src} alt={photo.name} />
          <Button
            className="next-photo"
            variant="outline"
            size="icon"
            aria-label="次の写真"
            disabled={index === siblings.length - 1}
            onClick={() => next && navigate('/photo/' + next.id)}
          >
            <ArrowRight size={20} />
          </Button>
        </div>
        <div className="detail-caption">
          <h1>{photo.name}</h1>
          <p>
            {photo.date.replaceAll('-', ' / ')} ・ {photo.location}
          </p>
        </div>
        {showInfo && (
          <aside className="info-panel">
            <h2>写真の情報</h2>
            <p>ファイル名</p>
            <strong>{photo.name}</strong>
            <p>追加日（UTC）</p>
            <strong>{photo.date}</strong>
            <p>撮影情報</p>
            <strong>{photo.location}</strong>
            <p>アルバム</p>
            <div className="album-summary">
              {!photo.albums.length ? (
                <span>アルバムなし</span>
              ) : (
                photo.albums
                  .slice(0, 3)
                  .map((name) => <span key={name}>{name}</span>)
              )}
              {photo.albums.length > 3 && (
                <span>ほか{photo.albums.length - 3}件</span>
              )}
            </div>
            <small>撮影日時・位置情報は元ファイルに保持しています。</small>
          </aside>
        )}
      </div>
    );
  }
  function Album() {
    const { name } = useParams();
    return (
      <>
        <button className="back-link" onClick={() => navigate('/albums')}>
          <ArrowLeft size={16} />
          アルバムに戻る
        </button>
        <Gallery album={name} />
      </>
    );
  }
  return (
    <div className="app-shell">
      <Toaster position="bottom-center" richColors />
      <header className="topbar">
        <button
          className="mobile-toggle"
          aria-label="メニュー"
          aria-expanded={mobileMenu}
          aria-controls="library-menu"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          <Menu />
        </button>
        <NavLink to="/" className="brand">
          <span className="brand-icon">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>
            ひより<span className="brand-dot">.</span>
          </span>
        </NavLink>
        <Button
          className="mobile-upload"
          variant="secondary"
          size="icon"
          aria-label="写真をアップロード"
          onClick={() => setUpload(true)}
        >
          <Plus size={23} />
        </Button>
        <div className="header-right">
          <span className="private-label">
            <span />
            ふたりだけのスペース
          </span>
          <button
            className="avatar"
            aria-label="共有スペースの情報"
            onClick={() =>
              toast.info(
                displayName +
                  'として接続しています。ふたりの共有ライブラリです。',
              )
            }
          >
            H
          </button>
        </div>
      </header>
      {mobileMenu && (
        <button
          className="mobile-menu-backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        id="library-menu"
        className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}
      >
        <Button className="upload-button" onClick={() => setUpload(true)}>
          <Plus size={22} />
          写真を追加
        </Button>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={21} />
              <span>{label}</span>
              {to === '/' && <span className="nav-count">{active.length}</span>}
            </NavLink>
          ))}
          <div className="nav-separator" />
          <NavLink
            to="/trash"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Trash2 size={21} />
            <span>ゴミ箱</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="space-card">
            <div className="space-icon">
              <Cloud size={21} />
            </div>
            <div>
              <strong>ふたりのライブラリ</strong>
              <span>思い出を、一緒に。</span>
            </div>
            <div className="small-avatars">
              <span>H</span>
              <span>M</span>
            </div>
          </div>
          <div className="prototype-note">
            <span />
            デザインプレビュー
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/favorites" element={<Gallery />} />
          <Route path="/trash" element={<Gallery />} />
          <Route
            path="/albums"
            element={
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">COLLECTIONS OF YOUR DAYS</div>
                    <h1>アルバム</h1>
                    <p>思い出をまとめて、何度でも。</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setAlbumModal(true)}
                  >
                    <Plus size={18} />
                    アルバムを作成
                  </Button>
                </div>
                <div className="album-grid">
                  {albumNames.map((name) => {
                    const cover = active.find((p) => p.albums.includes(name));
                    return (
                      <button
                        className="album-card"
                        key={name}
                        onClick={() =>
                          navigate('/album/' + encodeURIComponent(name))
                        }
                      >
                        {cover ? (
                          <img src={cover.src} alt={name} />
                        ) : (
                          <div className="album-placeholder">
                            <FolderHeart size={45} />
                          </div>
                        )}
                        <h2>
                          {name}
                          <ChevronRight size={18} />
                        </h2>
                        <p>
                          {active.filter((p) => p.albums.includes(name)).length}
                          枚の写真
                        </p>
                      </button>
                    );
                  })}
                  <button
                    className="new-album"
                    onClick={() => setAlbumModal(true)}
                  >
                    <Plus size={30} />
                    <span>新しいアルバム</span>
                  </button>
                </div>
              </>
            }
          />
          <Route path="/album/:name" element={<Album />} />
          <Route path="/photo/:id" element={<Detail />} />
        </Routes>
      </main>
      {!mobileMenu && (
        <nav className="mobile-bottom-nav" aria-label="メインナビゲーション">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `mobile-nav-link ${isActive || (to === '/albums' && location.pathname.startsWith('/album/')) ? 'active' : ''}`
              }
            >
              <span className="mobile-nav-icon">
                <Icon size={22} />
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <BulkTrashDialog
        open={bulkTrashOpen}
        onOpenChange={setBulkTrashOpen}
        photoIds={selected}
        album={
          location.pathname.startsWith('/album/')
            ? decodeURIComponent(location.pathname.slice('/album/'.length))
            : undefined
        }
        onSaved={(ids) => {
          setSelected([]);
          setPhotos((previous) =>
            previous.map((photo) =>
              ids.includes(photo.id) ? { ...photo, deleted: true } : photo,
            ),
          );
        }}
        onReload={async () => {
          const [nextPhotos, nextAlbums] = await Promise.all([
            api.list(),
            api.albums(),
          ]);
          setPhotos(nextPhotos);
          setNewAlbums(nextAlbums);
        }}
      />
      <BulkAlbumDialog
        open={bulkAlbumOpen}
        onOpenChange={setBulkAlbumOpen}
        photoIds={selected}
        albums={newAlbums}
        onSaved={() => setSelected([])}
        onReload={async () => {
          const [nextPhotos, nextAlbums] = await Promise.all([
            api.list(),
            api.albums(),
          ]);
          setPhotos(nextPhotos);
          setNewAlbums(nextAlbums);
        }}
      />
      <Dialog open={upload} onOpenChange={setUpload}>
        <DialogContent>
          <DialogTitle className="dialog-title">思い出を追加</DialogTitle>
          <DialogDescription className="dialog-description">
            あなたの一枚が、ふたりの思い出に。
          </DialogDescription>
          <button
            className="upload-dropzone"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <span className="upload-illustration">
              {uploading ? (
                <LoaderCircle className="animate-spin" size={32} />
              ) : (
                <ImagePlus size={32} />
              )}
            </span>
            <strong>
              {uploading ? '写真を追加しています…' : '写真を選択する'}
            </strong>
            <span>JPEG・PNG・WebP ／ 1枚50MB・6,000万画素まで</span>
          </button>
          <p className="modal-note">
            追加した写真は、ふたりのライブラリに保存されます。
          </p>
        </DialogContent>
      </Dialog>
      <input
        type="file"
        ref={fileInput}
        className="hidden"
        accept={acceptedTypes.join(',')}
        multiple
        onChange={uploadFiles}
      />
      <Dialog
        open={!!deletePhoto}
        onOpenChange={(open) => !open && setDeletePhoto(null)}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            ゴミ箱に移動しますか？
          </DialogTitle>
          <DialogDescription className="dialog-description">
            「{deletePhoto?.name}
            」をライブラリから移動します。ゴミ箱から元に戻せます。
          </DialogDescription>
          <div className="dialog-buttons">
            <Button variant="outline" onClick={() => setDeletePhoto(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={remove}>
              ゴミ箱に移動
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {editingAlbumPhoto && (
        <AlbumEditor
          key={editingAlbumPhoto.id}
          open={albumEditorOpen}
          photo={editingAlbumPhoto}
          names={albumNames}
          onPhotos={setPhotos}
          onClose={() => {
            setAlbumEditorOpen(false);
          }}
        />
      )}
      <Dialog open={albumModal} onOpenChange={setAlbumModal}>
        <DialogContent>
          <DialogTitle className="dialog-title">新しいアルバム</DialogTitle>
          <DialogDescription className="dialog-description">
            思い出に、名前をつけましょう。
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const name = albumName.trim();
              if (!name) return;
              if (albumNames.includes(name)) {
                toast.error('同じ名前のアルバムがあります');
                return;
              }
              try {
                await api.createAlbum(name);
              } catch (error) {
                toast.error((error as Error).message);
                return;
              }
              setNewAlbums((prev) => [...prev, name]);
              setAlbumModal(false);
              setAlbumName('');
              navigate('/album/' + encodeURIComponent(name));
              toast.success(
                'アルバムを作成しました。写真の情報から追加できます。',
              );
            }}
          >
            <label className="input-label" htmlFor="album-name">
              アルバム名
            </label>
            <input
              id="album-name"
              className="text-input"
              placeholder="例：ふたりの夏休み"
              value={albumName}
              maxLength={50}
              onChange={(e) => setAlbumName(e.target.value)}
              required
            />
            <div className="dialog-buttons">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAlbumModal(false)}
              >
                キャンセル
              </Button>
              <Button type="submit">作成する</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
