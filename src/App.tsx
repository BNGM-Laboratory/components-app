import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Tooltip,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Avatar,
  Modal,
  Backdrop,
  Fade,
  Chip,
  Card,
  LinearProgress,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  CloudOff as CloudOffIcon,
  CloudDownload as CloudDownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccountCircle as AccountCircleIcon,
  ExitToApp as LogoutIcon,
  FileUpload as FileUploadIcon,
} from '@mui/icons-material';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { db, auth } from './firebase';

// ==================== Типы данных ====================
interface Component {
  id?: string;
  name: string;
  marking: string;
  parameters: string;
  imageData?: string;
  storageCell: string;
  quantity: number;
  datasheetFileName?: string;
  datasheetUrl?: string;
  note: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ==================== Компонент входа/регистрации ====================
const AuthScreen: React.FC<{ onAuth: (user: User) => void }> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuth(userCredential.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка аутентификации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', p: 4, borderRadius: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          {isLogin ? 'Вход' : 'Регистрация'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Пароль"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3, py: 1.5 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </Button>
        </form>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button onClick={() => setIsLogin(!isLogin)} color="primary">
            {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </Button>
        </Box>
      </Card>
    </Box>
  );
};

// ==================== Основной компонент ====================
const App: React.FC = () => {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [components, setComponents] = useState<Component[]>([]);
  const [filteredComponents, setFilteredComponents] = useState<Component[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<keyof Component>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [formData, setFormData] = useState<Partial<Component>>({
    name: '',
    marking: '',
    parameters: '',
    storageCell: '',
    quantity: 0,
    note: '',
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // === Состояния для диалога массового импорта ===
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // ========== Аутентификация ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // ========== Загрузка данных из Firestore ==========
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'components'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Component[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Component);
      });
      setComponents(items);
      setLoadingData(false);
    }, (error) => {
      console.error('Ошибка загрузки данных:', error);
      setSnackbar({ open: true, message: 'Ошибка загрузки данных', severity: 'error' });
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ========== Обработка изменений сети ==========
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ========== Фильтрация и сортировка ==========
  useEffect(() => {
    let filtered = [...components];
    if (searchTerm.trim()) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerTerm) ||
          c.marking.toLowerCase().includes(lowerTerm)
      );
    }
    filtered.sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    setFilteredComponents(filtered);
    setPage(0);
  }, [components, searchTerm, sortColumn, sortDirection]);

  // ========== CRUD операции ==========
  const addComponent = async (component: Omit<Component, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'components'), {
        ...component,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setSnackbar({ open: true, message: 'Компонент добавлен', severity: 'success' });
      return docRef.id;
    } catch (error) {
      console.error('Ошибка добавления:', error);
      setSnackbar({ open: true, message: 'Ошибка добавления компонента', severity: 'error' });
      throw error;
    }
  };

  const updateComponent = async (id: string, data: Partial<Component>) => {
    try {
      await updateDoc(doc(db, 'components', id), {
        ...data,
        updatedAt: new Date(),
      });
      setSnackbar({ open: true, message: 'Компонент обновлён', severity: 'success' });
    } catch (error) {
      console.error('Ошибка обновления:', error);
      setSnackbar({ open: true, message: 'Ошибка обновления компонента', severity: 'error' });
      throw error;
    }
  };

  const deleteComponent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'components', id));
      setSnackbar({ open: true, message: 'Компонент удалён', severity: 'success' });
    } catch (error) {
      console.error('Ошибка удаления:', error);
      setSnackbar({ open: true, message: 'Ошибка удаления компонента', severity: 'error' });
      throw error;
    }
  };

  // ========== Обработчики UI ==========
  const handleSort = (column: keyof Component) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setFormData({ ...component });
    setModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingComponent(null);
    setFormData({
      name: '',
      marking: '',
      parameters: '',
      storageCell: '',
      quantity: 0,
      note: '',
      imageData: '',
      datasheetFileName: '',
      datasheetUrl: '',
    });
    setModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setSnackbar({ open: true, message: 'Введите наименование компонента', severity: 'error' });
      return;
    }
    if (!formData.marking || formData.marking.trim() === '') {
      setSnackbar({ open: true, message: 'Введите маркировку компонента', severity: 'error' });
      return;
    }

    const componentData: Omit<Component, 'id'> = {
      name: formData.name.trim(),
      marking: formData.marking.trim(),
      parameters: formData.parameters || '',
      storageCell: formData.storageCell || '',
      quantity: Number(formData.quantity) || 0,
      note: formData.note || '',
      imageData: formData.imageData || '',
      datasheetFileName: formData.datasheetFileName || '',
      datasheetUrl: formData.datasheetUrl || '',
    };

    try {
      if (editingComponent?.id) {
        await updateComponent(editingComponent.id, componentData);
      } else {
        await addComponent(componentData);
      }
      setModalOpen(false);
      setFormData({
        name: '',
        marking: '',
        parameters: '',
        storageCell: '',
        quantity: 0,
        note: '',
      });
      setEditingComponent(null);
    } catch (error) {
      // ошибка уже обработана в функциях
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Удалить компонент?')) {
      await deleteComponent(id);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageData: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (imageSrc: string) => {
    setZoomedImage(imageSrc);
    setImageZoomOpen(true);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setAnchorEl(null);
  };

  // ========== Обработчики массового импорта ==========
  const handleOpenImportDialog = () => {
    setImportText('');
    setImportDialogOpen(true);
  };

  const handleImportMarkings = async () => {
    if (!importText.trim()) {
      setSnackbar({ open: true, message: 'Введите список маркировок', severity: 'warning' });
      return;
    }

    // Разбиваем по запятой, убираем пробелы, фильтруем пустые
    const markings = importText.split(',').map(m => m.trim()).filter(m => m.length > 0);
    if (markings.length === 0) {
      setSnackbar({ open: true, message: 'Не найдено ни одной маркировки', severity: 'warning' });
      return;
    }

    setImportLoading(true);
    let successCount = 0;

    try {
      for (const marking of markings) {
        const newComponent: Omit<Component, 'id'> = {
          name: '',               // можно оставить пустым или задать значение по умолчанию
          marking: marking,
          parameters: '',
          storageCell: '',
          quantity: 0,
          note: '',
          imageData: '',
          datasheetFileName: '',
          datasheetUrl: '',
        };
        await addComponent(newComponent);
        successCount++;
      }
      setSnackbar({
        open: true,
        message: `Успешно импортировано ${successCount} маркировок`,
        severity: 'success',
      });
      setImportDialogOpen(false);
      setImportText('');
    } catch (error) {
      console.error('Ошибка импорта:', error);
      setSnackbar({ open: true, message: 'Ошибка при импорте', severity: 'error' });
    } finally {
      setImportLoading(false);
    }
  };

  // ========== Вспомогательные компоненты ==========
  const ImageThumbnail: React.FC<{ src?: string }> = ({ src }) => {
    if (!src) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Нет фото</Typography>;
    return (
      <Avatar
        src={src}
        variant="rounded"
        sx={{
          width: 50,
          height: 50,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'scale(1.2)',
            boxShadow: theme.shadows[4],
          },
        }}
        onClick={() => handleImageClick(src)}
      />
    );
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: 'error', icon: <WarningIcon />, text: 'Нет' };
    if (quantity < 10) return { color: 'warning', icon: <WarningIcon />, text: 'Мало' };
    if (quantity < 50) return { color: 'info', icon: <InventoryIcon />, text: 'Средне' };
    return { color: 'success', icon: <CheckCircleIcon />, text: 'Много' };
  };

  // ========== Обработка даташитов ==========
  const handleSearchDatasheetOnline = (component: Component) => {
    if (!isOnline) {
      setSnackbar({ open: true, message: 'Нет интернета', severity: 'warning' });
      return;
    }
    const query = encodeURIComponent(`${component.name} ${component.marking} datasheet PDF`);
    const searchUrl = `https://www.google.com/search?q=${query}`;
    window.open(searchUrl, '_blank');
    setSnackbar({ open: true, message: 'Поиск открыт в новой вкладке', severity: 'info' });
  };

  const handleDatasheetClick = (component: Component) => {
    if (component.datasheetUrl) {
      window.open(component.datasheetUrl, '_blank');
    } else {
      handleSearchDatasheetOnline(component);
    }
  };

  // ========== Пагинация ==========
  const paginatedComponents = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredComponents.slice(start, start + rowsPerPage);
  }, [filteredComponents, page, rowsPerPage]);

  // ========== Загрузка ==========
  if (loadingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={(user) => setUser(user)} />;
  }

  // ========== Основной рендер ==========
  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* App Bar */}
      <AppBar position="sticky" sx={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, color: '#667eea', fontWeight: 'bold' }}>
            📦 Electronics Components
          </Typography>
          <Button color="inherit" onClick={handleAddNew} startIcon={<AddIcon />} sx={{ color: '#667eea' }}>
            Добавить
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={handleOpenImportDialog}
            sx={{ color: '#764ba2', borderColor: '#764ba2', ml: 1 }}
          >
            Импорт
          </Button>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 2, color: '#667eea' }}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{user.email}</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Выйти
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Индикатор офлайн */}
        {!isOnline && (
          <Alert icon={<CloudOffIcon />} severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            Нет подключения к интернету. Данные будут синхронизированы при восстановлении соединения.
          </Alert>
        )}

        {/* Заголовок-карточка */}
        <Card sx={{
          mb: 4,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          p: 3,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h3" component="h1" sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                mb: 1,
              }}>
                Электронные компоненты
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
                Управление складом электронных компонентов
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField
                placeholder="Поиск по наименованию или маркировке..."
                variant="outlined"
                size="medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  width: 350,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    backgroundColor: 'white',
                  }
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#667eea' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddNew}
                sx={{
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(102,126,234,0.6)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Добавить компонент
              </Button>
            </Stack>
          </Box>
        </Card>

        {/* Статистика */}
        <Card sx={{ mb: 3, borderRadius: 3, p: 2 }}>
          <Stack direction="row" spacing={3} sx={{ justifyContent: 'space-around', flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#667eea' }}>
                {components.length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Всего компонентов</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#764ba2' }}>
                {components.reduce((sum, c) => sum + c.quantity, 0)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Всего на складе</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#f093fb' }}>
                {components.filter(c => c.quantity < 10).length}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Мало на складе</Typography>
            </Box>
          </Stack>
        </Card>

        {/* Таблица */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                  {[
                    { key: 'name', label: 'Наименование' },
                    { key: 'marking', label: 'Маркировка' },
                    { key: 'parameters', label: 'Параметры' },
                    { key: 'imageData', label: 'Вид' },
                    { key: 'storageCell', label: 'Ячейка' },
                    { key: 'quantity', label: 'Количество' },
                    { key: 'datasheetUrl', label: 'Даташит' },
                    { key: 'note', label: 'Примечание' },
                    { key: 'actions', label: 'Действия' },
                  ].map((col) => (
                    <TableCell
                      key={col.key}
                      onClick={() => col.key !== 'actions' && col.key !== 'imageData' && handleSort(col.key as keyof Component)}
                      sx={{
                        cursor: col.key !== 'actions' && col.key !== 'imageData' ? 'pointer' : 'default',
                        fontWeight: 'bold',
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      }}
                    >
                      {col.label}
                      {sortColumn === col.key && (
                        <Typography variant="caption" sx={{ ml: 1, color: '#667eea' }}>
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingData ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : paginatedComponents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                        Нет данных. Добавьте первый компонент!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedComponents.map((comp) => {
                    const stockStatus = getStockStatus(comp.quantity);
                    return (
                      <TableRow
                        key={comp.id}
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                            transform: 'translateX(4px)',
                            transition: 'all 0.2s ease',
                          },
                        }}
                      >
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer', fontWeight: 500 }}>
                          {comp.name}
                        </TableCell>
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                          <Chip label={comp.marking} size="small" sx={{ backgroundColor: alpha('#667eea', 0.1), color: '#667eea' }} />
                        </TableCell>
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                          {comp.parameters}
                        </TableCell>
                        <TableCell>
                          <ImageThumbnail src={comp.imageData} />
                        </TableCell>
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                          <Chip label={comp.storageCell || '—'} size="small" variant="outlined" sx={{ borderColor: '#764ba2', color: '#764ba2' }} />
                        </TableCell>
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {comp.quantity} шт.
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min((comp.quantity / 200) * 100, 100)}
                              sx={{
                                mt: 0.5,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: alpha(
                                  stockStatus.color === 'success' ? '#4caf50' :
                                    stockStatus.color === 'warning' ? '#ff9800' : '#f44336',
                                  0.2
                                ),
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: stockStatus.color === 'success' ? '#4caf50' :
                                    stockStatus.color === 'warning' ? '#ff9800' : '#f44336',
                                },
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {comp.datasheetUrl ? (
                              <Button
                                size="small"
                                onClick={() => handleDatasheetClick(comp)}
                                startIcon={<PdfIcon />}
                                sx={{ borderRadius: 2, textTransform: 'none' }}
                              >
                                PDF
                              </Button>
                            ) : (
                              <Tooltip title={isOnline ? 'Поиск даташита' : 'Нет интернета'}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleSearchDatasheetOnline(comp)}
                                  disabled={!isOnline}
                                  sx={{ color: '#667eea' }}
                                >
                                  <CloudDownloadIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell onClick={() => handleEdit(comp)} sx={{ cursor: 'pointer' }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                            {comp.note}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Редактировать">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(comp)}
                              sx={{ color: '#667eea', '&:hover': { backgroundColor: alpha('#667eea', 0.1) } }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(comp.id!)}
                              sx={{ color: '#f44336', '&:hover': { backgroundColor: alpha('#f44336', 0.1) } }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredComponents.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}
          />
        </Paper>

        {/* Модальное окно добавления/редактирования */}
        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <Typography variant="h5">
              {editingComponent ? 'Редактирование компонента' : 'Добавление нового компонента'}
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ mt: 2 }}>
            <Stack spacing={2}>
              <TextField
                label="Наименование *"
                fullWidth
                value={formData.name || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <TextField
                label="Маркировка *"
                fullWidth
                value={formData.marking || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, marking: e.target.value }))}
                required
              />
              <TextField
                label="Основные параметры"
                fullWidth
                multiline
                rows={2}
                value={formData.parameters || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, parameters: e.target.value }))}
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom>Изображение компонента</Typography>
                <Button variant="outlined" component="label" startIcon={<ImageIcon />}>
                  Загрузить фото
                  <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
                {formData.imageData && (
                  <Box sx={{ mt: 1 }}>
                    <img src={formData.imageData} alt="preview" style={{ maxHeight: 100, maxWidth: '100%', borderRadius: 8 }} />
                  </Box>
                )}
              </Box>
              <TextField
                label="Ячейка на складе"
                fullWidth
                value={formData.storageCell || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, storageCell: e.target.value }))}
              />
              <TextField
                label="Количество"
                type="number"
                fullWidth
                value={formData.quantity || 0}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
              />
              <TextField
                label="Ссылка на даташит (URL)"
                fullWidth
                value={formData.datasheetUrl || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, datasheetUrl: e.target.value }))}
                placeholder="https://example.com/datasheet.pdf"
              />
              <TextField
                label="Примечание"
                fullWidth
                multiline
                rows={2}
                value={formData.note || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button
              variant="contained"
              onClick={handleSaveForm}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { transform: 'translateY(-2px)' },
                transition: 'all 0.3s ease',
              }}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог массового импорта маркировок */}
        <Dialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <Typography variant="h5">Импорт маркировок</Typography>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Введите маркировки через запятую (каждая маркировка будет создана как отдельный компонент).
              Остальные поля будут пустыми — вы сможете заполнить их позже.
            </Typography>
            <TextField
              label="Список маркировок"
              placeholder="Например: BC547, 2N2222, IRF540, 1N4148"
              fullWidth
              multiline
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              disabled={importLoading}
            />
            {importLoading && <CircularProgress size={24} sx={{ mt: 2 }} />}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setImportDialogOpen(false)} disabled={importLoading}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={handleImportMarkings}
              disabled={importLoading || !importText.trim()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': { transform: 'translateY(-2px)' },
                transition: 'all 0.3s ease',
              }}
            >
              Импортировать
            </Button>
          </DialogActions>
        </Dialog>

        {/* Модальное окно увеличения изображения */}
        <Modal
          open={imageZoomOpen}
          onClose={() => setImageZoomOpen(false)}
          closeAfterTransition
          slots={{ backdrop: Backdrop }}
          slotProps={{ backdrop: { timeout: 500 } }}
        >
          <Fade in={imageZoomOpen}>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '90vw',
                maxHeight: '90vh',
                bgcolor: 'background.paper',
                boxShadow: 24,
                p: 2,
                borderRadius: 2,
              }}
            >
              <img src={zoomedImage} alt="Увеличенное изображение" style={{ maxWidth: '100%', maxHeight: '80vh' }} />
            </Box>
          </Fade>
        </Modal>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default App;