interface SignOutProps {
  onSignOut: () => void;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export function SignOut({ onSignOut, user }: SignOutProps) {
  return (
    <div className="user-menu">
      <div className="user-info">
        {user.avatar && (
          <img 
            src={user.avatar} 
            alt={user.name} 
            className="user-avatar"
          />
        )}
        <div className="user-details">
          <span className="user-name">{user.name}</span>
          <span className="user-email">{user.email}</span>
        </div>
      </div>
      <button 
        className="sign-out-button"
        onClick={onSignOut}
        title="Sign out"
      >
        Sign Out
      </button>
    </div>
  );
}