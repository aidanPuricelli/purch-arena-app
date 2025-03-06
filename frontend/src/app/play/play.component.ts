import { ChangeDetectorRef, Component, HostListener, input, NgZone, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { io } from 'socket.io-client';
import { timer } from 'rxjs';
import { environment } from '../../environments/environments';

interface PlayedCard {
  card: any;
  x: number;
  y: number;
  tapped?: boolean;
  counters?: number;
}

interface GameAction {
  type: 'tap' | 'untap' | 'sendToGraveyard' | 'exile' | 'discard' | 'moveBack';
  cards?: { 
    card: PlayedCard; 
    previousState?: boolean;
    previousLocation?: 'play' | 'hand' | 'graveyard' | 'exile';
    previousPosition?: { x: number; y: number };
  }[];
}

interface Card {
  name: string;
  id: string;
  image_uris?: {
    normal: string;
  };
}

interface GameStateResponse {
  opponentBoards: OpponentBoard[];
}

interface OpponentBoard {
  playerId: string;
  playCards: PlayedCard[];
}

declare const window: any;

@Component({
  selector: 'app-play',
  templateUrl: './play.component.html',
  styleUrls: ['./play.component.css']
})
export class PlayComponent implements OnInit, OnDestroy {
  private _apiUrl = environment.apiUrl;

  // Add getter and setter for serverPort to maintain template compatibility
  get serverPort(): string {
    return this._apiUrl;
  }

  set serverPort(value: string) {
    this._apiUrl = value;
  }

  get apiUrl(): string {
    return this._apiUrl;
  }

  set apiUrl(value: string) {
    this._apiUrl = value;
  }

  actionHistory: GameAction[] = [];

  tokenTypes: { name: string; imageUrl: string }[] = [];
  selectedToken: string = '';

  zoomedCard: any = null;

  lifeFontSize = 30;

  // MATCHMAKING
  roomId: string = '';
  opponentPlayCards: PlayedCard[] = []; 
  showRoomModal = false;
  playerId = '';
  opponentBoards: { playerId: string, playCards: any[] }[] = [];
  showPlayerIdModal = false;
  showUrlModal = false;
  showNgrokTokenModal = false;
  ngrokToken: string = '';

  // webrtc (possible replacement for polling)
  socket: any;
  peerConnection!: RTCPeerConnection;
  dataChannel!: RTCDataChannel;

  opponentTestData = [
      {
          playerId: "player_stue39t44",
          playCards: [
              {
                  card: {
                      name: "Hashaton, Scarab's Fist",
                      mana_cost: "{W}{B}",
                      type_line: "Legendary Creature — Zombie Wizard",
                      image_uri: "https://cards.scryfall.io/normal/front/0/2/02645651-cd55-4bd0-8a4d-fa257270a0e0.jpg?1739303903"
                  },
                  x: 193,
                  y: 209,
                  counters: 5
              },
              {
                  card: {
                      name: "Irrigated Farmland",
                      mana_cost: "",
                      type_line: "Land — Plains Island",
                      image_uri: "https://cards.scryfall.io/normal/front/7/3/7352e874-d332-4a98-ab3f-513f8cb3a76a.jpg?1706241172"
                  },
                  x: 563.5,
                  y: 365.8125,
                  tapped: true
              },
              {
                  card: {
                      name: "Desert of the Mindful",
                      mana_cost: "",
                      type_line: "Land — Desert",
                      image_uri: "https://cards.scryfall.io/normal/front/5/1/517f71a7-ec5b-46a6-b5ff-8c06abf0a630.jpg?1625980016"
                  },
                  x: 595,
                  y: 392.8125,
                  tapped: true
              },
              {
                  card: {
                      name: "Avacyn, Angel of Hope",
                      mana_cost: "{5}{W}{W}{W}",
                      type_line: "Legendary Creature — Angel",
                      image_uri: "https://cards.scryfall.io/normal/front/3/1/317f1133-7cf8-4b7a-919e-88c45f8c2c3a.jpg?1689995555"
                  },
                  x: 643.5,
                  y: 116.8125
              }
          ]
      }
  ];



  resizeFlag = false;
  advancedFlag = false;
  deckSelectFlag = false;
  showSettings = false;
  handFlag = true;
  minimizedOptions = true;
  showNav = true;
  showTimer = false;
  myTimer = false;

  selectedDeckCard: any = null;
  showTutor: boolean = false;
  showToken: boolean = false;

  deckNames: string[] = [];
  selectedDeck: string = ''; 

  isDragging = false;
  selectionBox = { x: 0, y: 0, width: 0, height: 0 };
  startX = 0;
  startY = 0;
  selectedPlayCards: PlayedCard[] = [];

  deck: any[] = [];
  hand: any[] = [];
  graveyard: any[] = [];
  exile: any[] = [];

  // Cards placed in the play area.
  playCards: PlayedCard[] = [];
  commander: any | null = null;

  draggedCard: any = null;
  draggedSource: 'hand' | 'play' | null = null;

  contextMenuVisible: boolean = false;
  showGrave: boolean = false;
  contextMenuX: number = 0;
  contextMenuY: number = 0;
  selectedCard: any = null;
  graveContextMenuVisible: boolean = false;
  graveContextMenuX: number = 0;
  graveContextMenuY: number = 0;
  selectedGraveCard: any = null;

  playContextMenuVisible: boolean = false;
  playContextMenuX: number = 0;
  playContextMenuY: number = 0;
  selectedPlayCard: PlayedCard | null = null;

  playOptionsFontSize = 18;
  playOptionsPosition = 80;
  opponentsPosition = 70;
  opponentHeight = 70;

  life = 20;

  cardWidth = 200;

  navLinks = [
    { text: 'Home', href: '/' }
  ];

  showSaveModal = false;
  showLoadModal = false;
  savedStates: string[] = [];
  selectedSavedState: string = '';
  saveGameName = '';

  showOpponentsBoard = false;


  // timer
  timeLeft: number = 7200; // 2 hours in seconds
  timerInterval: any;

  // Add a new property to track multiplayer URL
  private _multiplayerUrl: string = '';

  public isConnected: boolean = false;

  public isFullScreen: boolean = false;

  // update card width
  updateCardWidth(newWidth: number): void {
    this.cardWidth = newWidth;
    this.cdRef.detectChanges();
  }

  // ***************************
  // need to combine all toggle
  // methods into a single method
  // ***************************

  // toggle display of settings drop down
  toggleSettings(): void {
    if (this.resizeFlag || this.deckSelectFlag) {
      this.resizeFlag = false;
      this.deckSelectFlag = false;
      return
    }
    if (this.advancedFlag) this.advancedFlag = false;
    this.showSettings = !this.showSettings;
  }

  // toggle display of card resize
  toggleResize() {
    this.resizeFlag = !this.resizeFlag;
    this.showSettings = false;
  }

  // toggle display of card resize
  toggleAdvanced() {
    this.advancedFlag = !this.advancedFlag;
  }

  // toggle display of hand
  toggleHand() {
    this.handFlag = !this.handFlag;
    this.showSettings = false;
  }

  // toggle display of deck selection
  toggleDeckSelect() {
    this.deckSelectFlag = !this.deckSelectFlag;
    this.showSettings = false;
  }

  // toggle display of play options
  toggleOptions() {
    this.minimizedOptions = !this.minimizedOptions;
    this.showSettings = false;
  }

  // toggle display of nav
  toggleNav() {
    this.showNav = !this.showNav;
    this.showSettings = false;

    if (this.showNav) {
      this.opponentHeight = 70;
      this.playOptionsPosition = 80;
      this.opponentsPosition = 70;
    } else {
      this.opponentHeight = 0;
      this.opponentsPosition = 0;
      this.playOptionsPosition = 20;

    }
    document.documentElement.style.setProperty('--play-options-position', `${this.playOptionsPosition}px`);
    document.documentElement.style.setProperty('--deck-selection-position', `${this.playOptionsPosition + 120}px`);
    document.documentElement.style.setProperty('--opponents-position', `${this.opponentsPosition}px`);
    document.documentElement.style.setProperty('--opponent-height', `${this.opponentHeight}px`);
  }

  constructor(private http: HttpClient, private cdRef: ChangeDetectorRef, private zone: NgZone) {}

  // on init of page
  ngOnInit(): void {
    this.loadSettings();
    this.loadDeckNames();
    this.fetchTokens();
    this.updateFontSize();
    this.fetchNgrokUrl();
    this.initializeWebRTC();

    this.playerId = localStorage.getItem("playerId") || this.generatePlayerId();
    console.log("🔹 Assigned playerId:", this.playerId);

    // ✅ Listen for real-time game state updates
    this.socket.on('update-game-state', ({ playerId, playCards }: { playerId: string; playCards: any[] }) => {
      console.log(`📡 Received updated game state from ${playerId}`, playCards);
      
      // ✅ Update only the opponent's board
      this.opponentBoards = this.opponentBoards.map(board =>
          board.playerId === playerId ? { playerId, playCards } : board
      );

      // ✅ If no board exists for this player, add a new entry
      if (!this.opponentBoards.some(board => board.playerId === playerId)) {
          this.opponentBoards.push({ playerId, playCards });
      }
    });
  }

  generatePlayerId(): string {
    return `player_${Math.random().toString(36).substr(2, 9)}`; // Generates a unique ID
  }

  // update font size of play options
  updateFontSize() {
    document.documentElement.style.setProperty('--play-options-font-size', `${this.playOptionsFontSize}px`);
    document.documentElement.style.setProperty('--life-font-size', `${this.playOptionsFontSize + 10}px`);
  }

  // Fetch all tokens
  fetchTokens(url: string = 'https://api.scryfall.com/cards/search?q=game:paper+t:token+is:unique'): void {
    this.http.get<{ data: any[], has_more: boolean, next_page: string }>(url).subscribe(
      (response) => {
        this.tokenTypes = [
          ...this.tokenTypes,
          ...response.data.map(token => ({
            name: token.name,
            imageUrl: token.image_uris?.normal || 'https://example.com/default-token.jpg'
          }))
        ];
  
        console.log('Tokens fetched so far:', this.tokenTypes.length);
  
        if (response.has_more && response.next_page) {
          this.fetchTokens(response.next_page);
        } else {
          this.addExtraTokens();
        }
      },
      (error) => console.error('Error fetching tokens:', error)
    );
  }

  // Get some extra tokens
  addExtraTokens(): void {
    const extraTokens = [
      { name: 'Treasure', imageUrl: 'https://cards.scryfall.io/normal/front/b/b/bbe8bced-9524-47f6-a600-bf4ddc072698.jpg?1562539795' },
      { name: 'Food', imageUrl: 'https://cards.scryfall.io/normal/front/b/f/bf36408d-ed85-497f-8e68-d3a922c388a0.jpg?1572489210' },
      { name: 'Clue', imageUrl: 'https://cards.scryfall.io/normal/front/2/9/291e6490-6727-45ae-90ba-de2ff8f63162.jpg?1562086863' },
    ];
  
    this.tokenTypes = [...this.tokenTypes, ...extraTokens];
  
    console.log('Extra tokens added:', extraTokens.map(t => t.name));
  }
  
  // Add token to play area
  placeTokenInPlay(): void {
    const token = this.tokenTypes.find(t => t.name === this.selectedToken);
    if (token) {
        const tokenCard = {
            id: `token-${token.name}`,
            name: token.name,
            image_uris: { normal: token.imageUrl } // Ensure correct property name
        };

      this.playCards.push({ card: tokenCard, x: 150, y: 150, counters: 0 });
      console.log(`Token placed in play area:`, tokenCard);
      this.sendGameState();
    } else {
        console.warn('No token selected!');
    }
  }


  // Load all available deck names
  loadDeckNames(): void {
    const headers = new HttpHeaders({
      "ngrok-skip-browser-warning": "true"
    });
  
    this.http.get<{ deckNames: string[] }>(`${this._apiUrl}/api/decks`, {headers}).subscribe(
      (response) => {
        this.deckNames = response.deckNames;
        console.log('Available Decks:', this.deckNames);
      },
      (error) => console.error('Error loading deck names', error)
    );
  }

  // Increase counters for selected cards
  increaseCounterOnSelectedCards(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
  
    if (this.selectedPlayCards.length > 0) {
      this.selectedPlayCards.forEach(card => {
        card.counters = (card.counters || 0) + 1;
      });

      this.cdRef.detectChanges();
  
      console.log("Increased counters for selected cards:", this.selectedPlayCards);
    }
  }
  
  // Decrease counters for selected cards
  decreaseCounterOnSelectedCards(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  
    if (this.selectedPlayCards.length > 0) {
      this.selectedPlayCards.forEach(card => {
        if (card.counters && card.counters > 0) {
          card.counters = Math.max(0, card.counters - 1);
        }
      });
  
      this.cdRef.detectChanges();
  
      console.log("Decreased counters for selected cards:", this.selectedPlayCards);
    }
  }
  

  // Increase counter for a specific card (direct click)
  increaseCounter(card: PlayedCard, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    card.counters = (card.counters || 0) + 1;
    console.log(`Increased counter for ${card.card.name}:`, card.counters);
  }

  // Decrease counter for a specific card (direct click)
  decreaseCounter(card: PlayedCard, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    if (card.counters && card.counters > 0) {
      card.counters = Math.max(0, card.counters - 1);
      console.log(`Decreased counter for ${card.card.name}:`, card.counters);
    }
  }
  
  // Increase life
  increaseLife() {
    this.life++;
  }

  // Decrease life
  decreaseLife(event: MouseEvent) {
    event.preventDefault();
    this.life--;
  }
  

  onDeckSelected(): void {
    if (!this.selectedDeck) return;
  
    console.log(`Loading deck: '${this.selectedDeck}'`);
  
    const headers = new HttpHeaders({
      "ngrok-skip-browser-warning": "true"
    });
  
    this.http.get<{ deck: any[] }>(`${this._apiUrl}/api/decks/${this.selectedDeck}`, { headers })
      .subscribe(
        (response) => {
          this.deck = response.deck;
          console.log(`Loaded deck '${this.selectedDeck}':`, this.deck);
  
          this.playCards = [];
          this.graveyard = [];
          this.exile = [];
  
          this.toggleDeckSelect();
          this.loadCommander();
          this.shuffleDeck();
          this.drawHand();
        },
        (error) => console.error('Error loading deck', error)
      );
  }

  // Load commander for the selected deck
  loadCommander(): void {
    const headers = new HttpHeaders({
      "ngrok-skip-browser-warning": "true"
    });
    this.http.get<{ commander: any }>(`${this._apiUrl}/api/decks/${this.selectedDeck}/commander`, { headers }).subscribe(
      (response) => {
        if (response.commander) {
          this.commander = response.commander;
          console.log(`Commander loaded:`, this.commander);
          this.life = 40;
          this.placeCommanderInPlay();
        } else {
          console.log('No commander found for this deck.');
          this.life = 20;
        }
        
      },
      (error) => {
        console.error('Error loading commander', error);
        this.life = 20;
      }
    );
  }

  // Place commander in play area
  placeCommanderInPlay(): void {
    if (this.commander) {
      this.playCards.push({ card: this.commander, x: 100, y: 100 });
      console.log(`Commander placed in play area:`, this.commander);
    }
  }

  // Shuffle the deck 
  shuffleDeck(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    console.log('Deck shuffled:', this.deck);
  }

  // Draw the first 7 cards into the hand and remove them from the deck.
  drawHand(): void {
    const numCardsToDraw = Math.min(7, this.deck.length);
    this.hand = this.deck.slice(0, numCardsToDraw);
    this.deck.splice(0, numCardsToDraw);
    console.log('Hand drawn:', this.hand);
    console.log('Remaining deck:', this.deck);
  }

  // Draw a single card.
  drawCard(): void {
    if (this.deck.length > 0) {
      const drawnCard = this.deck.shift();
      this.hand.push(drawnCard);
      console.log('Card drawn:', drawnCard);
    } else {
      console.log('No cards left in deck.');
    }
  }  

  // Discard a card from hand.
  discardCard(card: any): void {
    const index = this.hand.indexOf(card);
    if (index !== -1) {
      const discardedCard = this.hand.splice(index, 1)[0];
      this.graveyard.push(discardedCard);
      console.log('Card discarded:', discardedCard);
    } else {
      console.log('Card not found in hand.');
    }
  }

  // Context menu for hand cards
  onRightClick(event: MouseEvent, card: any): void {
    event.preventDefault();
    this.selectedCard = card;
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuVisible = true;
  }

  // Toggle card selection on normal click
  toggleCardSelection(played: any, event: MouseEvent): void {
    event.stopPropagation();

    const index = this.selectedPlayCards.indexOf(played);

    if (index === -1) {
      this.selectedPlayCards.push(played);
    } else {
      this.selectedPlayCards.splice(index, 1);
    }

    this.cdRef.detectChanges();
  }


  // Discard a card
  discardSelectedCard(): void {
    if (this.selectedCard) {
      this.discardCard(this.selectedCard);
      this.hideContextMenu();
    }
  }

  // Hide context menu
  hideContextMenu(): void {
    this.contextMenuVisible = false;
    this.selectedCard = null;
  }

  // Context menu for play area cards
  onPlayRightClick(event: MouseEvent, played: PlayedCard): void {
    event.preventDefault();

    if (!this.selectedPlayCards.includes(played)) {
      this.selectedPlayCards.push(played);
    }

    this.selectedPlayCard = played;
    this.playContextMenuX = event.clientX;
    this.playContextMenuY = event.clientY;
    this.playContextMenuVisible = true;
  }

  // Tap all selected cards
  tapSelectedCard(): void {
    if (this.selectedPlayCards.length > 0) {

      this.actionHistory.push({
        type: 'tap',
        cards: this.selectedPlayCards.map(card => ({
          card,
          previousState: card.tapped
        }))
      });

      this.selectedPlayCards.forEach(card => card.tapped = true);
      this.hidePlayContextMenu();
    }
  }

  // Untap all selected cards
  untapSelectedCard(): void {
    if (this.selectedPlayCards.length > 0) {
      
      this.actionHistory.push({
        type: 'untap',
        cards: this.selectedPlayCards.map(card => ({
          card,
          previousState: card.tapped
        }))
      });

      this.selectedPlayCards.forEach(card => card.tapped = false);
      console.log("Untapped multiple cards:", this.selectedPlayCards);
      this.hidePlayContextMenu();
    }
  }

  // Toggle tapped state for a single card
  toggleTapCard(played: any, event: MouseEvent): void {
    event.stopPropagation();

    // Push the action of tapping the double-clicked card to the history
    this.actionHistory.push({
      type: 'tap',
      cards: [{
        card: played,
        previousState: played.tapped
      }]
    });

    // Toggle the tapped state
    played.tapped = !played.tapped;

    this.cdRef.detectChanges();

    console.log(`Card "${played.card.name}" tapped state: ${played.tapped}`);
  }


  // send selected to graveyard
  sendToGraveyardSelectedCard(): void {
    if (this.selectedPlayCards.length > 0) {
      const action: GameAction = {
        type: 'sendToGraveyard',
        cards: this.selectedPlayCards.map(card => ({
          card: { ...card.card },
          previousLocation: 'play',
          previousPosition: { x: card.x, y: card.y }
        }))
      };
  
      this.addActionToHistory(action);
  
      this.selectedPlayCards.forEach(card => {
        const index = this.playCards.indexOf(card);
        if (index !== -1) {
          this.playCards.splice(index, 1);
          this.graveyard.push(card.card);
        }
      });
  
      console.log("Moved selected cards to graveyard:", this.selectedPlayCards);
      this.selectedPlayCards = [];
      this.hidePlayContextMenu();
    }
  }
  
  // Exile functionality, add logic for logging action for undo
  exileSelectedCard(): void {
    if (this.selectedPlayCard) {
      console.log('Exile selected. Functionality not fully implemented.', this.selectedPlayCard);
      const index = this.playCards.indexOf(this.selectedPlayCard);
      if (index !== -1) {
        const removed = this.playCards.splice(index, 1)[0];
        this.exile.push(removed.card);
        console.log('Card sent to exile:', removed.card);
      }
    }
    this.hidePlayContextMenu();
  }

  // Hide play context menu
  hidePlayContextMenu(): void {
    this.playContextMenuVisible = false;
    this.selectedPlayCard = null;
  }

  // Listen
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.settings-dropdown');
    const settingsIcon = document.querySelector('.settings-icon');

    // Hide all context menus
    this.hideContextMenu();
    this.hidePlayContextMenu();
    this.hideGraveContextMenu();

    // Hide settings if the click is outside the dropdown and settings icon
    if (
      this.showSettings &&
      dropdown &&
      !dropdown.contains(target) &&
      settingsIcon &&
      !settingsIcon.contains(target)
    ) {
      this.showSettings = false;
    }
  }


  // Listen some more
  @HostListener('dblclick', ['$event'])
  onDoubleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('play-options')) {
      this.minimizedOptions = !this.minimizedOptions;
    }

    if (target.classList.contains('hand')) {
      this.handFlag = !this.minimizedOptions;
    }
  }

  // Listen even more?
  @HostListener('document:keydown.control.z', ['$event'])
  handleUndoShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    this.undoAction();
  }

  // ???
  @HostListener('document:keydown', ['$event'])
  handleDeleteKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.sendToGraveyardSelectedCard();
    }
  }

  // you're kidding
  @HostListener('document:keydown.control.g', ['$event'])
  handleShowGraveyardShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    this.showGraveyard();
  }

  // Track cursor offset when dragging
  private cursorOffsetX = 0;
  private cursorOffsetY = 0;

  // Drag and Drop methods
  onDragStart(event: DragEvent, item: any, source: 'hand' | 'play'): void {
    this.draggedSource = source;
    this.draggedCard = item;

    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify(item));
      event.dataTransfer.effectAllowed = 'move';

      const target = event.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      this.cursorOffsetX = event.clientX - rect.left;
      this.cursorOffsetY = event.clientY - rect.top;

      const dragImage = new Image();
      dragImage.src = item.card?.image_uri || item.image_uri || 'https://example.com/default-token.jpg';
      dragImage.width = this.cardWidth;

      const cardHeight = this.cardWidth * 1.4;
      dragImage.height = cardHeight;

      dragImage.style.position = 'absolute';
      dragImage.style.border = 'solid 3px white';
      dragImage.style.borderRadius = '10px';
      dragImage.style.opacity = '0.8';
      dragImage.style.pointerEvents = 'none';

      document.body.appendChild(dragImage);

      event.dataTransfer.setDragImage(dragImage, this.cursorOffsetX, this.cursorOffsetY);

      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  }

  // dragging over play area
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  // on dropping card
  onDrop(event: DragEvent): void {
    event.preventDefault();
    const playContainer = event.currentTarget as HTMLElement;
    const containerRect = playContainer.getBoundingClientRect();

    const dropX = event.clientX - containerRect.left - this.cursorOffsetX;
    const dropY = event.clientY - containerRect.top - this.cursorOffsetY;

    let cardData: any = null;
    if (event.dataTransfer) {
      const data = event.dataTransfer.getData('text/plain');
      if (data) {
        try {
          cardData = JSON.parse(data);
        } catch (err) {
          console.error('Error parsing drag data', err);
        }
      }
    }

    if (cardData && cardData.source === 'hand') {
      const card = cardData.card;
      const index = this.hand.indexOf(card);

      if (index !== -1) {
        this.hand.splice(index, 1);
      }

      this.playCards.push({ card: card, x: dropX, y: dropY });
    } else if (this.draggedCard) {
      if (this.draggedSource === 'hand') {
        const index = this.hand.indexOf(this.draggedCard);

        if (index !== -1) {
          this.hand.splice(index, 1);
        }

        this.playCards.push({ card: this.draggedCard, x: dropX, y: dropY });
      } else if (this.draggedSource === 'play') {
        const playedCard = this.draggedCard as PlayedCard;
        playedCard.x = dropX;
        playedCard.y = dropY;
      }
    }
    this.sendGameState();
    this.draggedCard = null;
    this.draggedSource = null;
  }

  // toggle show graveyardd
  showGraveyard() {
    this.showGrave = !this.showGrave;
  }

  // Right click open context menu (graveyard)
  onGraveRightClick(event: MouseEvent, card: any): void {
    event.preventDefault();
    this.selectedGraveCard = card;
    this.graveContextMenuX = event.clientX;
    this.graveContextMenuY = event.clientY;
    this.graveContextMenuVisible = true;
  }

  // Move back to hand
  handFromGraveyard(): void {
    if (this.selectedGraveCard) {
      const index = this.graveyard.indexOf(this.selectedGraveCard);
      if (index !== -1) {
        const returnedCard = this.graveyard.splice(index, 1)[0];
        this.hand.push(returnedCard);
        console.log('Returned card from graveyard to hand:', returnedCard);
      }
    }
    this.hideGraveContextMenu();
  }

  // Hides the graveyard context menu
  hideGraveContextMenu(): void {
    this.graveContextMenuVisible = false;
    this.selectedGraveCard = null;
  }

  // Send selected card to exile
  exileFromGraveyard(): void {
    if (this.selectedGraveCard) {
      const index = this.graveyard.indexOf(this.selectedGraveCard);
      if (index !== -1) {

        const exiledCard = this.graveyard.splice(index, 1)[0];

        this.exile.push(exiledCard);

        console.log('Sent card from graveyard to exile:', exiledCard);
      }
    }
    this.hideGraveContextMenu();
  }

  // Play selected card from graveyard
  playFromGraveyard(): void {
    if (this.selectedGraveCard) {
      const index = this.graveyard.indexOf(this.selectedGraveCard);
      if (index !== -1) {

        const cardToPlay = this.graveyard.splice(index, 1)[0];

        this.playCards.push({
          card: cardToPlay,
          x: 100,
          y: 100,
          tapped: false,
          counters: 0,
        });

        console.log('Played card from graveyard:', cardToPlay);
      }
    }
    this.hideGraveContextMenu();
  }

  // Mill
  mill(): void {
    if (this.deck.length > 0) {

      const milledCard = this.deck.shift();

      this.graveyard.push(milledCard);
      console.log('Milled card:', milledCard);
    } else {
      console.log('No cards left in the deck to mill.');
    }
  }  
  
  // Put card from hand on top of deck
  onTop(): void {
    let index = this.deck.indexOf(this.selectedCard);

    if (index !== -1) {
      const card = this.deck.splice(index, 1)[0];
      this.deck.unshift(card);
      console.log('Card moved to top of deck:', card);
    } else {
      index = this.hand.indexOf(this.selectedCard);

      if (index !== -1) {
        const card = this.hand.splice(index, 1)[0];
        this.deck.unshift(card);
        console.log('Card moved from hand to top of deck:', card);
      } else {
        console.log('Card not found in deck or hand.');
      }
    }

    this.contextMenuVisible = false;
    this.selectedCard = null;
  }

  // put card from hand on bottom of library
  onBottom(): void {
    let index = this.deck.indexOf(this.selectedCard);

    if (index !== -1) {
        const card = this.deck.splice(index, 1)[0];
        this.deck.push(card);
        console.log('Card moved to bottom of deck:', card);
    } else {
        index = this.hand.indexOf(this.selectedCard);

        if (index !== -1) {
            const card = this.hand.splice(index, 1)[0];
            this.deck.push(card);
            console.log('Card moved from hand to bottom of deck:', card);
        } else {
            console.log('Card not found in deck or hand.');
        }
    }

    this.contextMenuVisible = false;
    this.selectedCard = null;
  }


  // Move card from board back to hand
  backToHand(): void {
    if (this.selectedPlayCard) {
      const index = this.playCards.indexOf(this.selectedPlayCard);
      if (index !== -1) {
        const removed = this.playCards.splice(index, 1)[0];
        this.hand.push(removed.card);
        console.log('Card returned to hand:', removed.card);
      } else {
        console.log('Selected play card not found.');
      }
      this.hidePlayContextMenu();
    }
  }

  // Mouse Down (Start Selection)
  onMouseDown(event: MouseEvent): void {
    const playContainer = event.currentTarget as HTMLElement;
    const containerRect = playContainer.getBoundingClientRect();

    const target = event.target as HTMLElement;
    if (target.closest('.played-card')) {
      return;
    }
  
    this.isDragging = true;
    this.startX = event.clientX - containerRect.left;
    this.startY = event.clientY - containerRect.top;
    this.selectionBox = { x: this.startX, y: this.startY, width: 0, height: 0 };
  }
  
  // Mouse Move (Update Selection Box)
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const currentX = event.clientX;
    const currentY = event.clientY;

    this.selectionBox = {
      x: Math.min(this.startX, currentX),
      y: Math.min(this.startY, currentY),
      width: Math.abs(currentX - this.startX),
      height: Math.abs(currentY - this.startY)
    };
  }

  // Get all cards in selection box
  onMouseUp(event: MouseEvent): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
  
    this.selectedPlayCards = [];
  
    const selectionLeft = this.selectionBox.x;
    const selectionTop = this.selectionBox.y;
    const selectionRight = selectionLeft + this.selectionBox.width;
    const selectionBottom = selectionTop + this.selectionBox.height;
  
    this.playCards.forEach(card => {
      const cardLeft = card.x;
      const cardTop = card.y;
      const cardRight = cardLeft + 100;
      const cardBottom = cardTop + 140;
  
      if (
        cardRight >= selectionLeft &&
        cardLeft <= selectionRight &&
        cardBottom >= selectionTop &&
        cardTop <= selectionBottom
      ) {
        if (!this.selectedPlayCards.includes(card)) {
          this.selectedPlayCards.push(card);
        }
      }
    });
  
    if (this.selectedPlayCards.length > 0) {
      this.playContextMenuX = event.clientX;
      this.playContextMenuY = event.clientY;
      this.playContextMenuVisible = true;
    }
  }

  // Add selected card to hand and remove it from the deck
  addToHandFromDeck(): void {
    if (!this.selectedDeckCard) {
      console.warn('No card selected.');
      return;
    }

    const index = this.deck.indexOf(this.selectedDeckCard);
    if (index !== -1) {
      this.deck.splice(index, 1);
      this.hand.push(this.selectedDeckCard);
      console.log('Card added to hand:', this.selectedDeckCard);
    }

    this.selectedDeckCard = null;
  }

  // Toggle the TUTOR dropdown
  toggleTutor(): void {
    this.showTutor = !this.showTutor;
    if (this.showTutor) {
      this.showToken = false;
    }
  }

  // Toggle the TOKEN dropdown
  toggleToken(): void {
    this.showToken = !this.showToken;
    if (this.showToken) {
      this.showTutor = false;
    }
  }

  // Zoom 
  zoomSelectedCard(): void {
    if (this.selectedPlayCards.length === 1) {
      this.zoomedCard = this.selectedPlayCards[0].card;
      console.log('Zooming card:', this.zoomedCard);
    }
  }

  // Close zoom overlay when clicking outside
  closeZoom(): void {
    this.zoomedCard = null;
  }

  closeGraveyard() {
    this.showGrave = false;
  }

  // draw new 7
  newSeven() {
    this.playCards = [];
    this.graveyard = [];
    this.exile = [];
    this.hand = [];

    this.loadCommander();
    this.shuffleDeck();
    this.drawHand();
  }

  undoAction(): void {
    if (this.actionHistory.length === 0) {
      console.log("No actions to undo.");
      return;
    }
  
    const lastAction = this.actionHistory.pop();
    if (!lastAction || !lastAction.cards) return;
  
    console.log("Undoing action:", lastAction);
  
    lastAction.cards.forEach(entry => {
      switch (lastAction.type) {
        case 'tap':
        case 'untap':
          entry.card.tapped = entry.previousState ?? false;
          break;
  
        case 'sendToGraveyard':
          this.restoreCard(entry, this.graveyard, this.playCards, true);
          break;
  
        case 'exile':
          this.restoreCard(entry, this.exile, this.playCards, true);
          break;
  
        case 'discard':
          this.restoreCard(entry, this.graveyard, this.hand);
          break;
  
        case 'moveBack':
          this.restoreCard(entry, this.hand, this.deck);
          break;
  
        default:
          console.warn("Undo action type not recognized:", lastAction.type);
      }
    });
  
    console.log("Undo complete. Current state:", {
      hand: this.hand,
      play: this.playCards,
      graveyard: this.graveyard,
      exile: this.exile
    });
  }
  
  private restoreCard(
    entry: { card: any; previousLocation?: string; previousPosition?: { x: number; y: number } }, 
    fromZone: any[], 
    toZone: any[], 
    wrapAsPlayedCard: boolean = false
  ): void {
    const index = fromZone.findIndex(c => c.name === entry.card.name);
    if (index !== -1) {
      const restoredCard = fromZone.splice(index, 1)[0];
  
      if (wrapAsPlayedCard) {
        toZone.push({
          card: restoredCard, 
          x: entry.previousPosition?.x || 100, 
          y: entry.previousPosition?.y || 100 
        });
      } else {
        toZone.push(restoredCard);
      }
  
      console.log(`Restored ${entry.card.name} from ${entry.previousLocation} to ${wrapAsPlayedCard ? "play" : "another zone"}.`);
    } else {
      console.warn(`Could not restore ${entry.card.name}. Card not found in ${entry.previousLocation}.`);
    }
  }
  
  // add action to history, prune if needee
  addActionToHistory(action: GameAction): void {
    this.actionHistory.push(action);

    if (this.actionHistory.length > 10) {
      this.actionHistory.splice(0, this.actionHistory.length - 10);
      console.log("Action history pruned to last 10 actions.");
    }
  }

  // Open the save game modal
  openSaveModal() {
    this.showSaveModal = true;
    this.saveGameName = '';
  }

  // open load game modal
  openLoadModal() {
    this.showLoadModal = true;
    this.fetchSavedStates();
  }

  // Close the modal
  closeSaveModal() {
    this.showSaveModal = false;
    this.selectedSavedState = '';
  }

  // close load mocal
  closeLoadModal() {
    this.showLoadModal = false;
  }

  // Fetch saved states from server and remove .json extensions
  fetchSavedStates() {
    fetch(`${this._apiUrl}/api/game/saved-states`)
      .then(response => response.json())
      .then(data => {
        if (data.savedStates) {
          this.savedStates = data.savedStates.map((state: string) => state.replace(/\.json$/, ''));
        }
      })
      .catch(error => {
        console.error('Error fetching saved states:', error);
        alert('Failed to retrieve saved states.');
      });
  }

  // Load the selected game state
  loadSelectedState() {
    if (!this.selectedSavedState) {
      alert('Please select a saved state to load.');
      return;
    }

    const fileName = `${this.selectedSavedState}.json`;

    const headers = {
      "ngrok-skip-browser-warning": "true"
    };

    fetch(`${this._apiUrl}/api/game/load-game/${fileName}`, {headers})
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load game state: ${response.status}`);
        }
        return response.json();
      })
      .then((gameState) => {
        this.hand = gameState.hand.map((card: Card) => ({
          ...card,
          image_uris: card.image_uris || { normal: 'https://via.placeholder.com/200x280?text=No+Image' }
        }));

        this.playCards = gameState.play.map((pc: any) => ({
          card: {
            ...pc.card,
            image_uris: pc.card.image_uris || { normal: 'https://via.placeholder.com/200x280?text=No+Image' }
          },
          x: pc.x,
          y: pc.y,
          tapped: pc.tapped ?? false,
          counters: pc.counters ?? 0
        }));

        this.graveyard = gameState.graveyard.map((card: Card) => ({
          ...card,
          image_uris: card.image_uris || { normal: 'https://via.placeholder.com/200x280?text=No+Image' }
        }));

        this.exile = gameState.exile.map((card: Card) => ({
          ...card,
          image_uris: card.image_uris || { normal: 'https://via.placeholder.com/200x280?text=No+Image' }
        }));

        this.deck = gameState.deck.map((card: Card) => ({
          ...card,
          image_uris: card.image_uris || { normal: 'https://via.placeholder.com/200x280?text=No+Image' }
        }));

        this.closeLoadModal();

        alert(`Game state "${this.selectedSavedState}" loaded successfully!`);
      })
      .catch(error => {
        console.error('Error loading game state:', error);
        alert('Failed to load the selected game state.');
      });
  }



  // save game state
  saveState() {
    if (!this.saveGameName) {
      alert('Please enter a name for the game state.');
      return;
    }

    const gameState = {
      hand: this.hand.map(card => ({
        name: card.name,
        id: card.id,
        image_uri: card.image_uri || 'https://via.placeholder.com/200x280?text=No+Image'
      })),
      play: this.playCards.map(pc => ({
        card: {
          name: pc.card.name,
          id: pc.card.id,
          image_uri: pc.card.image_uri || 'https://via.placeholder.com/200x280?text=No+Image'
        },
        x: pc.x,
        y: pc.y,
        tapped: pc.tapped ?? false,
        counters: pc.counters ?? 0
      })),
      graveyard: this.graveyard.map(card => ({
        name: card.name,
        id: card.id,
        image_uri: card.image_uri || 'https://via.placeholder.com/200x280?text=No+Image'
      })),
      exile: this.exile.map(card => ({
        name: card.name,
        id: card.id,
        image_uri: card.image_uri || 'https://via.placeholder.com/200x280?text=No+Image'
      })),
      deck: this.deck.map(card => ({
        name: card.name,
        id: card.id,
        image_uri: card.image_uri || 'https://via.placeholder.com/200x280?text=No+Image'
      })),
      timestamp: new Date().toISOString()
    };

    // Send the game state to the server
    fetch(`${this._apiUrl}/api/game/save-game`, {
      method: 'POST',
      body: JSON.stringify({
        gameName: this.saveGameName,
        gameState: gameState
      }),
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
    })
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          alert(data.message);
          this.closeSaveModal();
        } else {
          alert('Failed to save game state.');
        }
      })
      .catch(error => {
        console.error('Error saving game state:', error);
        alert('Failed to save game state.');
      });
  }


  // save current card width and font-size
  saveSettings() {
    const settings = {
      cardWidth: this.cardWidth,
      playOptionsFontSize: this.playOptionsFontSize
    };

    fetch(`${this._apiUrl}/api/settings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        "ngrok-skip-browser-warning": "true" 
      },
      body: JSON.stringify(settings),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to save settings: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.message) {
          console.log('Settings saved:', settings);
        } else {
          throw new Error('Failed to save settings');
        }
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
      });
  }

  // load card width and font size
  loadSettings() {
    const headers = {
      "ngrok-skip-browser-warning": "true"
    };
    fetch(`${this._apiUrl}/api/settings`, {headers})
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.status}`);
        }
        return response.json();
      })
      .then(settings => {
        if (settings.cardWidth !== undefined) {
          this.cardWidth = settings.cardWidth;
          console.log('Loaded card width:', this.cardWidth);
        }
        if (settings.playOptionsFontSize !== undefined) {
          this.playOptionsFontSize = settings.playOptionsFontSize;
          console.log('Loaded font size:', this.playOptionsFontSize);
          this.updateFontSize();
        }
      })
      .catch(error => {
        console.error('Failed to load settings:', error);
        // Use default values if loading fails
        this.cardWidth = 200;
        this.playOptionsFontSize = 18;
        this.updateFontSize();
      });
  }

  fetchNgrokUrl(): void {
    const headers = new HttpHeaders({
        "ngrok-skip-browser-warning": "true"
    });

    console.log('Fetching ngrok URL from:', `${this._apiUrl}/api/settings/ngrok-url`);

    this.http.get<{url: string}>(`${this._apiUrl}/api/settings/ngrok-url`, {headers})
        .subscribe(
            (response) => {
                if (response.url) {
                    console.log('Received ngrok URL:', response.url);
                    this._multiplayerUrl = response.url;
                    console.log('Updated multiplayer URL to:', this._multiplayerUrl);
                } else {
                    console.warn('No ngrok URL received from server');
                }
            },
            (error) => {
                console.error('Error fetching ngrok URL:', error);
                // Fall back to local URL
                console.log('Falling back to local URL:', this._apiUrl);
            }
        );
  }

  // ************************************
  // MATCHMAKING 
  // ************************************
  createRoom() {
    console.log('Creating room...');
    // First check if we have a ngrok token
    const headers = new HttpHeaders({
      "ngrok-skip-browser-warning": "true"
    });

    this.http.get<{hasToken: boolean}>(`${this._apiUrl}/api/settings/check-ngrok-token`, {headers}).subscribe(
      (response) => {
        console.log('Token check response:', response);
        if (!response.hasToken) {
          console.log('No token found, showing token modal');
          this.showNgrokTokenModal = true;
        } else {
          console.log('Token found, creating room');
          this.createRoomWithToken();
        }
      },
      (error) => {
        console.error('Error checking ngrok token:', error);
        alert('Failed to check ngrok token. Please try again.');
      }
    );
  }

  createRoomWithToken() {
    console.log('Creating room with token...');
    const headers = new HttpHeaders({
      "ngrok-skip-browser-warning": "true"
    });

    this.http.post<{roomId: string, serverUrl: string}>(
      `${this._multiplayerUrl || this._apiUrl}/api/matchmaking/create-room`, 
      {}, 
      {headers}
    ).subscribe(
      (response) => {
        console.log('Room created:', response);
        this.roomId = response.roomId;
        this._multiplayerUrl = response.serverUrl;
        
        const connectionDetails = `URL: ${response.serverUrl}\nRoom ID: ${response.roomId}`;
        console.log('Connection details:', connectionDetails);
        
        navigator.clipboard.writeText(connectionDetails).then(() => {
          console.log('Connection details copied to clipboard');
          alert('Room created! Connection details copied to clipboard. Share these with other players.');
        }).catch(err => {
          console.error('Failed to copy to clipboard:', err);
          alert(`Room created!\nURL: ${response.serverUrl}\nRoom ID: ${response.roomId}`);
        });

        this.myTimer = true;
        this.startTimer();
        this.initializeWebRTC();
      },
      (error) => {
        console.error('Error creating room:', error);
        if (error.status === 401) {
          alert('Invalid ngrok token. Please check your token and try again.');
          this.showNgrokTokenModal = true;
        } else {
          alert('Failed to create room. Please try again.');
        }
      }
    );
  }

  private initializeWebRTC() {
    console.log('Initializing WebRTC...');
    
    // For local development with Electron, connect to localhost
    const socketUrl = 'http://localhost:3000';
    console.log('Connecting to socket URL:', socketUrl);

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('Socket connected successfully. Socket ID:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected. Reason:', reason);
      this.isConnected = false;
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to connect to game server: ${errorMessage}`);
    });

    // ... rest of the socket event handlers ...
  }

  startWebRTC() {
    this.peerConnection = new RTCPeerConnection();
    this.dataChannel = this.peerConnection.createDataChannel('gameState');

    // Send game state when DataChannel is open
    this.dataChannel.onopen = () => {
      console.log('📡 DataChannel open!');
      this.sendGameState();
    };

    // Receive opponent's game state
    this.dataChannel.onmessage = (event) => {
      console.log('📩 Received game state:', event.data);
      this.opponentBoards = JSON.parse(event.data);
    };

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('send-ice-candidate', { target: this.peerConnection, candidate: event.candidate });
      }
    };

    // Create SDP offer
    this.peerConnection.createOffer().then((offer) => {
      this.peerConnection.setLocalDescription(offer);
      this.socket.emit('send-offer', { target: this.peerConnection, sdp: offer as RTCSessionDescriptionInit });
    });
  }

  sendGameState() {
    if (this.roomId) {
      // Emit the updated game state to the server
      this.socket.emit('sync-game-state', { 
        roomId: this.roomId, 
        playerId: this.playerId, 
        playCards: this.playCards 
      });
    }
  }

  setUrl(url: string) {
    this._apiUrl = url;
    this.closeUrlModal();
  }

  copyUrlToClipboard() {
    const connectionDetails = `URL: ${this._multiplayerUrl || this._apiUrl}\nRoom ID: ${this.roomId}`;
    navigator.clipboard.writeText(connectionDetails).then(() => {
      console.log('Connection details copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy URL:', err);
    });
  }

  copyRoomIdToClipboard() {
    navigator.clipboard.writeText(this.roomId).then(() => {
      console.log('Room ID copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  startTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(secs)}`;
  }

  padZero(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  toggleTimer() {
    this.showTimer = !this.showTimer;
  }

  toggleOppBoards() {
    this.showOpponentsBoard = !this.showOpponentsBoard;
    this.handFlag = !this.handFlag;
  }

  // Open the join room modal
  openUrlModal() {
    this.showUrlModal = true;
  }

  // Close the modal
  closeUrlModal() {
    this.showUrlModal = false;
  }

  // Matchmaking related methods
  saveNgrokToken() {
    if (!this.ngrokToken) {
      alert('Please enter your ngrok token');
      return;
    }

    this.http.post(`${this._apiUrl}/api/settings/ngrok-token`, { token: this.ngrokToken }).subscribe(
      () => {
        this.showNgrokTokenModal = false;
        this.ngrokToken = '';
        this.createRoomWithToken();
      },
      (error) => {
        console.error('Error saving ngrok token:', error);
        alert('Failed to save ngrok token. Please try again.');
      }
    );
  }

  closeNgrokTokenModal() {
    this.showNgrokTokenModal = false;
    this.ngrokToken = '';
  }

  joinRoom(roomId: string) {
    if (!this.playerId) {
      console.error("Player ID is missing!");
      return;
    }

    console.log(`Joining room with ID: ${roomId} as player: ${this.playerId}`);

    this.http.post(`${this._multiplayerUrl || this._apiUrl}/api/matchmaking/join-room`, {
      roomId,
      playerId: this.playerId
    }).subscribe(
      (response) => {
        console.log('Joined room:', response);
        this.roomId = roomId;
        this.syncGameState(roomId);
      },
      (error) => {
        console.error('Error joining room:', error);
      }
    );
    this.closeRoomModal();
  }

  syncGameState(roomId: string) {
    if (!this.playerId) {
      console.error("Player ID is missing!");
      return;
    }
  
    console.log("Sending playCards to server:", this.playCards);
  
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
  
    // Convert absolute x, y positions to percentages
    const playCardsWithPercentage = this.playCards.map(card => ({
      ...card,
      x: card.x / screenWidth,  // Convert to percentage
      y: card.y / screenHeight, // Convert to percentage
    }));
  
    this.http.post(`${this._multiplayerUrl || this._apiUrl}/api/game/sync-state`, { 
      roomId, 
      playerId: this.playerId, 
      playCards: playCardsWithPercentage,
      screenWidth,
      screenHeight
    }).subscribe(
      (response) => {
        console.log('Game state synced:', response);
        this.fetchOpponentBoards(roomId);
        this.sendGameState();
      },
      (error) => {
        console.error('Error syncing game state:', error);
      }
    );
  }

  // Modal related methods
  setPlayerId(inputId: string) {
    this.playerId = inputId;
    this.showPlayerIdModal = false;
  }

  openPlayerIdModal() {
    this.showPlayerIdModal = true;
  }

  closePlayerIdModal() {
    this.showPlayerIdModal = false;
  }

  openRoomModal() {
    this.showRoomModal = true;
  }

  closeRoomModal() {
    this.showRoomModal = false;
  }

  fetchOpponentBoards(roomId: string) {
    console.log("Fetching opponent boards...");
  
    if (environment.nodeEnv === 'test') {
      this.opponentBoards = this.opponentTestData;
    } else {
      this.http.get<GameStateResponse>(
        `${this._multiplayerUrl || this._apiUrl}/api/game/game-state/${roomId}/${this.playerId}`,
        { headers: new HttpHeaders({ "ngrok-skip-browser-warning": "true" }) }
      ).subscribe(
        (response: GameStateResponse) => {
          console.log("Raw Response:", response);
  
          const userScreenWidth = window.innerWidth;
          const userScreenHeight = window.innerHeight;
  
          response.opponentBoards.forEach((opponent: OpponentBoard) => {
            opponent.playCards.forEach((card: PlayedCard) => {
              // Convert percentage-based x and y back to pixel values
              card.x = card.x * userScreenWidth;
              card.y = card.y * userScreenHeight;
            });
          });
  
          this.opponentBoards = response.opponentBoards;
          console.log("Parsed Opponent Boards (Final State):", this.opponentBoards);
        },
        (error) => {
          console.error('Error fetching opponent boards:', error);
        }
      );
    }
  }

  ngOnDestroy() {
    // Clean up socket connection if it exists
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Add this method to toggle full-screen
  toggleFullScreen(): void {
    if (window.electron) {
      window.electron.ipcRenderer.send('toggle-fullscreen');
      this.isFullScreen = !this.isFullScreen;
    }
  }

  // Add keyboard shortcut for full-screen (F11)
  @HostListener('document:keydown.f11', ['$event'])
  handleFullScreenShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    this.toggleFullScreen();
  }

} // End of PlayComponent class

