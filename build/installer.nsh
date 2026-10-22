!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to keep your ChunkHarbor servers, worlds, and backups?" IDYES KeepData IDNO RemoveData
  RemoveData:
    RMDir /r "$APPDATA\ChunkHarbor"
    RMDir /r "$APPDATA\VoxelPulse"
    RMDir /r "$APPDATA\BlockHost"
  KeepData:
!macroend
