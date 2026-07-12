import sqlite3
from werkzeug.security import generate_password_hash

def run_migration():
    print("Migrando base de datos para añadir contraseñas...")
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    try:
        c.execute('ALTER TABLE users ADD COLUMN password TEXT')
        print("Columna 'password' añadida con éxito.")
    except sqlite3.OperationalError as e:
        print("La columna 'password' probablemente ya existe:", e)
        
    # Asignar contraseña por defecto (123456) a cuentas viejas
    default_hash = generate_password_hash('123456')
    c.execute('UPDATE users SET password = ? WHERE password IS NULL', (default_hash,))
    
    conn.commit()
    conn.close()
    print("Contraseñas asignadas exitosamente.")

if __name__ == '__main__':
    run_migration()
