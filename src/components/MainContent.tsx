import { Box, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

interface MainContentProps {
  isMobile: boolean;
  isSidebarOpen: boolean;
  onMenuClick: () => void;
  children: React.ReactNode;
}

const Main = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isMobile' && prop !== 'isSidebarOpen',
})<{ isMobile: boolean; isSidebarOpen: boolean }>(({ theme, isMobile, isSidebarOpen }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.grey[900],
  minHeight: '100vh',
  ...(isMobile && {
    marginTop: isSidebarOpen ? '240px' : 0,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const MainContent = ({ isMobile, isSidebarOpen, onMenuClick, children }: MainContentProps) => {
  return (
    <Main isMobile={isMobile} isSidebarOpen={isSidebarOpen}>
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={onMenuClick}
          edge="start"
          sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1 }}
        >
          <MenuIcon />
        </IconButton>
      )}
      {children}
    </Main>
  );
};

export default MainContent; 