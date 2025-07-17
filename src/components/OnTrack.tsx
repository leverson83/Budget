import { Box, Typography } from '@mui/material';

const OnTrack = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        OnTrack
      </Typography>
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="h5" color="text.secondary">
          Coming Soon
        </Typography>
      </Box>
    </Box>
  );
};

export default OnTrack; 