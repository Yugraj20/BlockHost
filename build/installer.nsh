!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to keep your BlockHost servers, worlds, and backups in %APPDATA%\BlockHost?" IDYES KeepData IDNO RemoveData
  RemoveData:
    RMDir /r "$APPDATA\BlockHost"
  KeepData:
!macroend
