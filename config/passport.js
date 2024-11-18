const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

// Serialize user ID into session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user ID from session
passport.deserializeUser((id, done) => {
  db.get('SELECT id, username FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return done(err);
    if (!row) return done(null, false);
    return done(null, row);
  });
});

// Configure the local strategy for login
passport.use(
  'local-login',
  new LocalStrategy((username, password, done) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) return done(err);
      if (!row) return done(null, false, { message: 'Incorrect username or password.' });

      // Compare hashed password
      const isValidPassword = await bcrypt.compare(password, row.password);
      if (!isValidPassword) return done(null, false, { message: 'Incorrect username or password.' });

      return done(null, row);
    });
  })
);

// Configure the local strategy for signup
passport.use(
  'local-signup',
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    async (req, username, password, done) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) return done(err);
        if (row) return done(null, false, { message: 'Username already exists.' });

        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            function (err) {
              if (err) return done(err);
              return done(null, { id: this.lastID, username });
            }
          );
        } catch (hashError) {
          return done(hashError);
        }
      });
    }
  )
);

module.exports = passport;