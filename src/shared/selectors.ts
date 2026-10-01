/**
 * Every YouTube Music DOM selector the app depends on. YTM changes its markup often;
 * when a feature stops working, this is the first place to look. Each feature degrades
 * gracefully (does nothing) when its selector stops matching.
 *
 * Playback control goes through the #movie_player API instead of buttons wherever possible,
 * because that API has been stable for years while the markup is not.
 */
export const SEL = {
  player: '#movie_player',
  video: 'video.html5-main-video, #movie_player video',
  /** Where the toolbar is inserted, before the avatar / sign-in button. */
  navRight: 'ytmusic-nav-bar #right-content',
  likeButton: 'ytmusic-miniplayer like-button-view-model button, ytmusic-player-bar like-button-view-model button',
  dislikeButton: 'ytmusic-miniplayer dislike-button-view-model button, ytmusic-player-bar dislike-button-view-model button',
  skipAdButton: [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button',
    'button[id^="skip-button"]',
    '.ytp-ad-skip-button-container button',
  ].join(', '),
  /**
   * Shuffle / repeat. YTM A/B-tests two player layouts: the classic player bar (buttons with
   * these classes, repeat state in its \`repeat-mode\` attribute) and a newer one where the two
   * toggle buttons are the only player controls with \`aria-pressed\` (shuffle first, repeat last).
   */
  shuffleButton: 'ytmusic-player-bar yt-icon-button.shuffle',
  repeatButton: 'ytmusic-player-bar yt-icon-button.repeat',
  playerBar: 'ytmusic-player-bar',
  toggleButtons: 'ytmusic-wiz-player-controls button[aria-pressed]',
  /** YTM's own volume slider. Driving it keeps YTM's UI and remembered volume in sync. */
  volumeSlider: '.ytMusicMiniPlayerVolumePopup input[type=range], ytmusic-player-bar #volume-slider input',
  /** Player-page tabs: Up next, Lyrics, Related… */
  playerPageTabs: 'ytmusic-player-page tp-yt-paper-tab',
} as const

/** Classes on the player while an ad plays. */
export const AD_CLASS = 'ad-showing'
