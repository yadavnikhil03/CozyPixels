!macro NSIS_HOOK_PREUNINSTALL
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to completely remove your CozyPixels preferences and downloaded wallpapers?" IDNO keep_data
    
    # User clicked YES
    RMDir /r "$LOCALAPPDATA\com.cozypixels.desktop"
    RMDir /r "$APPDATA\com.cozypixels.desktop"
    Delete "$TEMP\cozypixels_*"
    
    keep_data:
!macroend

!macro NSIS_HOOK_POSTINSTALL
    # Remove the desktop shortcut that Tauri creates by default
    Delete "$DESKTOP\CozyPixels.lnk"
    Delete "$COMMONDESKTOP\CozyPixels.lnk"
!macroend
