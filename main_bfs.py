import tkinter as tk
from PIL import Image, ImageTk
import random

# --- Constants ---
WINDOW_WIDTH = 800
WINDOW_HEIGHT = 600
FPS_DELAY = 20  
GRAVITY = 1.2
JUMP_STRENGTH = -18
SPEED = 6
FLOOR_Y = 410
PUSH_DISTANCE = 72

class MonkeyGame:
    def __init__(self, root):
        self.root = root
        self.root.title("Monkey & Banana - BFS AI Simulation")
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.root.resizable(False, False)

        self.canvas = tk.Canvas(self.root, width=WINDOW_WIDTH, height=WINDOW_HEIGHT, highlightthickness=0)
        self.canvas.pack()

        # Dictionary to store references to images
        self.assets = {}
        
        # Internal Game State Variables (Controlled ONLY by AI now)
        self.keys = {"Left": False, "Right": False, "Shift_L": False, "Shift_R": False, "space": False}
        self.monkey_dy = 0
        self.is_jumping = False
        self.bananas_collected = 0
        self.frame_index = 0
        self.anim_counter = 0
        self.facing_direction = 1 
        
        # AI Variables
        self.auto_is_active = True 
        self.auto_plan = []
        self.win_text = None

        self.setup_game()

    def setup_game(self):
        self.draw_pro_background()
        self.load_all_assets()
        self.create_game_objects()
        
        
        self.start_bfs_simulation()
        self.game_loop()

    def draw_pro_background(self):
      
        random.seed(42)

        # Sky
        for i in range(120):
            r = int(20 + (135 - 20) * (i / 120))
            g = int(100 + (206 - 100) * (i / 120))
            b = int(200 + (250 - 200) * (i / 120))
            color = f'#{r:02x}{g:02x}{b:02x}'
            self.canvas.create_rectangle(0, i*5, WINDOW_WIDTH, (i+1)*5, fill=color, outline="")

        # Sun
        glow_colors = ["#FFF7A1", "#FFEA00", "#FFB300", "#FF8C00", "#FF5E00"]
        sizes = [80, 60, 45, 30, 20]
        for idx, size in enumerate(sizes):
            self.canvas.create_oval(680-size, 100-size, 680+size, 100+size, fill=glow_colors[idx], outline="")

        # Birds
        birds = [(150, 120), (190, 100), (130, 150), (550, 180), (590, 160)]
        for bx, by in birds:
            self.canvas.create_line(bx, by, bx+10, by-8, bx+20, by, fill="#1A3A5A", width=2, smooth=True)

        # Pyramids
        self.canvas.create_polygon(50, 450, 150, 280, 250, 450, fill="#D4B872", outline="")
        self.canvas.create_polygon(150, 280, 250, 450, 200, 450, fill="#B89B56", outline="")
        self.canvas.create_polygon(120, 450, 280, 150, 440, 450, fill="#F2D388", outline="")
        self.canvas.create_polygon(280, 150, 440, 450, 340, 450, fill="#C4A864", outline="")
        self.canvas.create_polygon(300, 450, 450, 200, 600, 450, fill="#E6C981", outline="")
        self.canvas.create_polygon(450, 200, 600, 450, 500, 450, fill="#B3934B", outline="")

        # Hills
        self.canvas.create_polygon(-100, 450, 100, 280, 400, 450, fill="#247854", outline="", smooth=True)
        self.canvas.create_polygon(300, 450, 600, 250, 900, 450, fill="#1D6646", outline="", smooth=True)
        self.canvas.create_polygon(-50, 450, 200, 320, 500, 450, fill="#2E8B57", outline="", smooth=True)
        self.canvas.create_polygon(400, 450, 700, 300, 900, 450, fill="#3CB371", outline="", smooth=True)

        # Clouds
        cloud_positions = [(180, 80), (450, 60), (750, 110)]
        for cx, cy in cloud_positions:
            self.canvas.create_oval(cx-28, cy-12, cx+12, cy+28, fill="#A5C6E6", outline="")
            self.canvas.create_oval(cx-8, cy-28, cx+42, cy+22, fill="#A5C6E6", outline="")
            self.canvas.create_oval(cx+22, cy-18, cx+62, cy+22, fill="#A5C6E6", outline="")
            self.canvas.create_oval(cx-30, cy-15, cx+10, cy+25, fill="#FFFFFF", outline="")
            self.canvas.create_oval(cx-10, cy-30, cx+40, cy+20, fill="#FFFFFF", outline="")
            self.canvas.create_oval(cx+20, cy-20, cx+60, cy+20, fill="#FFFFFF", outline="")
            self.canvas.create_oval(cx, cy-5, cx+50, cy+25, fill="#FFFFFF", outline="")

        # Ground
        self.canvas.create_rectangle(0, 450, WINDOW_WIDTH, WINDOW_HEIGHT, fill="#5C3A21", outline="") 
        self.canvas.create_rectangle(0, 450, WINDOW_WIDTH, 480, fill="#5DBA40", outline="") 
        self.canvas.create_rectangle(0, 450, WINDOW_WIDTH, 465, fill="#4CA132", outline="") 

        # Grass & Flowers
        for i in range(0, WINDOW_WIDTH, 15):
            self.canvas.create_polygon(i, 450, i+7, 430, i+15, 450, fill="#4CA132", outline="")
            if random.random() > 0.6:
                flower_color = random.choice(["#FF4081", "#FFEB3B", "#00BCD4", "#FFFFFF"])
                self.canvas.create_oval(i+3, 435, i+10, 442, fill=flower_color, outline="")

        # Dirt Stones
        for _ in range(18):
            sx = random.randint(10, WINDOW_WIDTH-20)
            sy = random.randint(490, WINDOW_HEIGHT-15)
            self.canvas.create_oval(sx, sy, sx+18, sy+9, fill="#4A2F1D", outline="")

    def load_img(self, path, size):
        try:
            img = Image.open(f"Assets/{path}").convert("RGBA").resize(size)
            return ImageTk.PhotoImage(img)
        except Exception as e:
            print(f"Warning: Could not load {path}. {e}")
            return None

    def extract_movement_frames(self, path, frame_count_x, frame_count_y, target_size):
        try:
            img = Image.open(f"Assets/{path}").convert("RGBA")
        except Exception as e:
            return []
            
        datas = img.getdata()
        new_data = [
            (255, 255, 255, 0) if (p[0] < 40 and p[1] < 40 and p[2] < 40) else p 
            for p in datas
        ]
        
        img.putdata(new_data)
        frames = []
        sheet_w, sheet_h = img.size
        fw, fh = sheet_w // frame_count_x, sheet_h // frame_count_y
        
        for row in range(frame_count_y):
            for col in range(frame_count_x):
                left, top = col * fw, row * fh
                frame = img.crop((left, top, left + fw, top + fh))
                bbox = frame.getbbox()
                if bbox:
                    frame = frame.crop(bbox)
                frame = frame.resize(target_size)
                frames.append(ImageTk.PhotoImage(frame))
        return frames

    def load_all_assets(self):
        self.assets['idle'] = [
            self.load_img("monkey.png", (80, 80)),
            self.load_img("monkey_b1.png", (80, 80)),
            self.load_img("monkey_b2.png", (80, 80)),
            self.load_img("monkey_b3.png", (80, 80))
        ]
        self.assets['push_1'] = self.load_img("push_1.png", (80, 80))
        self.assets['push_2'] = self.load_img("push_2.png", (80, 80))
        self.assets['jump'] = self.load_img("jump.png", (80, 80))
        self.assets['box'] = self.load_img("box.png", (70, 70))
        self.assets['banana'] = self.load_img("banana.png", (65, 65))
        
        self.assets['move_1'] = self.extract_movement_frames("monkey_Movement_1.png", 4, 2, (70, 70))
        self.assets['move_2'] = self.extract_movement_frames("monkey_Movement_2.png", 4, 2, (70, 70))

    def create_game_objects(self):
        self.box = self.canvas.create_image(500, 415, image=self.assets['box'])
        self.monkey = self.canvas.create_image(100, FLOOR_Y, image=self.assets['idle'][0])
        
        banana_positions = [(250, 320), (500, 260), (680, 200)]
        self.bananas = [self.canvas.create_image(x, y, image=self.assets['banana']) for x, y in banana_positions]
        
        self.score_label = self.canvas.create_text(120, 30, text="Bananas: 0/3", font=("Arial", 20, "bold"), fill="white")

        
        self.btn_restart = tk.Button(self.root, text="Restart BFS Simulation ↺", font=("Arial", 12, "bold"), bg="#4ecdc4", command=self.start_bfs_simulation)
        self.canvas.create_window(680, 40, window=self.btn_restart)

    def start_bfs_simulation(self):
        
        
        for k in self.keys: self.keys[k] = False
        self.canvas.coords(self.monkey, 100, FLOOR_Y)
        self.canvas.coords(self.box, 500, 415)
        self.monkey_dy = 0
        self.is_jumping = False
        self.bananas_collected = 0
        self.facing_direction = 1
        self.canvas.itemconfig(self.score_label, text="Bananas: 0/3")
        
        for b in self.bananas:
            self.canvas.delete(b)
            
        banana_positions = [(250, 320), (500, 260), (680, 200)]
        self.bananas = [self.canvas.create_image(x, y, image=self.assets['banana']) for x, y in banana_positions]
        
        if self.win_text:
            self.canvas.delete(self.win_text)
            self.win_text = None

        
        self.auto_is_active = True
        self.auto_plan = [
            {'action': 'walk_to', 'targetX': 250},
            {'action': 'jump_up'},
            
            {'action': 'walk_to', 'targetX': 428},
            {'action': 'jump_right', 'targetX': 500},
            
            {'action': 'walk_off_left'}, 
            {'action': 'push_to', 'targetBoxX': 680}, 
            
            {'action': 'jump_right', 'targetX': 680}, 
            {'action': 'jump_up'} 
        ]

    def game_loop(self):
        monkey_x, monkey_y = self.canvas.coords(self.monkey)
        bx, by = self.canvas.coords(self.box)

        # --- AI CONTROLLER ---
        if self.auto_is_active and len(self.auto_plan) > 0:
            step = self.auto_plan[0]
            
            self.keys["Left"] = False
            self.keys["Right"] = False
            self.keys["Shift_L"] = False
            self.keys["space"] = False

            action = step['action']

            if action == 'walk_to':
                target_x = step['targetX']
                if abs(monkey_x - target_x) > SPEED:
                    if monkey_x < target_x: self.keys["Right"] = True
                    else: self.keys["Left"] = True
                else:
                    self.auto_plan.pop(0)
            
            elif action == 'jump_up':
                if not step.get('started', False):
                    self.keys["space"] = True
                    step['started'] = True
                elif not self.is_jumping:
                    self.auto_plan.pop(0)

            elif action == 'jump_right':
                target_x = step['targetX']
                if monkey_x < target_x:
                    self.keys["Right"] = True
                if not step.get('started', False):
                    self.keys["space"] = True
                    step['started'] = True
                elif not self.is_jumping:
                    self.auto_plan.pop(0)

            elif action == 'walk_off_left':
                self.keys["Left"] = True
                if monkey_y == FLOOR_Y:
                    self.auto_plan.pop(0)

            elif action == 'push_to':
                target_box_x = step['targetBoxX']
                if abs(bx - target_box_x) > SPEED:
                    self.keys["Shift_L"] = True
                    if bx < target_box_x: self.keys["Right"] = True
                    else: self.keys["Left"] = True
                else:
                    self.auto_plan.pop(0)
        
        elif self.auto_is_active and len(self.auto_plan) == 0:
            self.keys["Left"] = False
            self.keys["Right"] = False
            self.keys["Shift_L"] = False
            self.keys["space"] = False

        # --- Physics: Gravity & Floor Collision ---
        self.monkey_dy += GRAVITY
        monkey_y += self.monkey_dy
        
        if monkey_y >= FLOOR_Y:
            monkey_y = FLOOR_Y
            self.monkey_dy = 0
            self.is_jumping = False
        
        # --- Box Platform Collision ---
        if self.monkey_dy > 0 and (bx - 50 < monkey_x < bx + 50):
            if monkey_y >= by - 70 and (monkey_y - self.monkey_dy) <= by - 70:
                monkey_y = by - 70 
                self.monkey_dy = 0
                self.is_jumping = False

        # --- Movement Logic ---
        if self.bananas_collected < 3: 
            moving = False
            is_pushing = False
            intended_dx = 0

            if self.keys.get("Left"):
                intended_dx = -SPEED
                self.facing_direction = -1
                moving = True
            if self.keys.get("Right"):
                intended_dx = SPEED
                self.facing_direction = 1
                moving = True

            shift_pressed = self.keys.get("Shift_L") or self.keys.get("Shift_R")

            if moving and not self.is_jumping:
                distance_to_box = abs(monkey_x - bx)
                if monkey_y == FLOOR_Y and distance_to_box <= PUSH_DISTANCE:
                    if (self.facing_direction == 1 and monkey_x < bx) or (self.facing_direction == -1 and monkey_x > bx):
                        if shift_pressed:
                            is_pushing = True
                            new_bx = bx + (intended_dx * 0.8)
                            if 50 < new_bx < 750: 
                                self.canvas.coords(self.box, new_bx, by)
                                monkey_x += (intended_dx * 0.8)
                        else:
                            monkey_x = bx - (self.facing_direction * PUSH_DISTANCE)
                    else:
                        monkey_x += intended_dx 
                else:
                    monkey_x += intended_dx 
            else:
                monkey_x += intended_dx

            # Jumping
            if self.keys.get("space") and not self.is_jumping:
                self.monkey_dy = JUMP_STRENGTH
                self.is_jumping = True

            # Boundary Limits
            monkey_x = max(40, min(monkey_x, WINDOW_WIDTH - 40))

            # --- Animation Update ---
            current_img = self.assets['idle'][min(self.bananas_collected, 3)]
            
            if self.is_jumping:
                current_img = self.assets['jump']
            elif is_pushing:
                current_img = self.assets['push_1'] if self.facing_direction == 1 else self.assets['push_2']
            elif moving:
                self.anim_counter += 1
                if self.anim_counter >= 3: 
                    self.frame_index = (self.frame_index + 1) % len(self.assets['move_1'])
                    self.anim_counter = 0
                current_img = self.assets['move_1'][self.frame_index] if self.facing_direction == 1 else self.assets['move_2'][self.frame_index]

            self.canvas.coords(self.monkey, monkey_x, monkey_y)
            self.canvas.itemconfig(self.monkey, image=current_img)

        # --- Banana Collection & Win State ---
        for b in self.bananas[:]:
            b_x, b_y = self.canvas.coords(b)
            if abs(monkey_x - b_x) < 45 and abs(monkey_y - b_y) < 45:
                self.canvas.delete(b)
                self.bananas.remove(b)
                self.bananas_collected += 1
                self.canvas.itemconfig(self.score_label, text=f"Bananas: {self.bananas_collected}/3")
                
                if self.bananas_collected == 3:
                    if not self.win_text:
                        self.win_text = self.canvas.create_text(WINDOW_WIDTH//2, WINDOW_HEIGHT//2, text="GOAL STATE REACHED!", font=("Arial", 40, "bold"), fill="yellow")
                    self.auto_is_active = False

        # Loop
        self.root.after(FPS_DELAY, self.game_loop)

# --- Start Application ---
if __name__ == "__main__":
    root = tk.Tk()
    game = MonkeyGame(root)
    root.mainloop()