!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to keep your VoxelPulse servers, worlds, and backups in %APPDATA%\VoxelPulse?" IDYES KeepData IDNO RemoveData
  RemoveData:
    RMDir /r "$APPDATA\VoxelPulse"
    RMDir /r "$APPDATA\BlockHost"
  KeepData:
!macroend
