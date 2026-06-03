describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display the login page correctly', () => {
    cy.get('h1').should('contain', 'Login');
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
  });

  it('should show error on invalid credentials', () => {
    cy.get('input[name="email"]').type('nonexistent@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    
    cy.get('.bg-rose-500').should('be.visible')
      .and('contain', 'Invalid email or password');
  });

  it('should navigate to registration page', () => {
    cy.get('a[href*="register"]').click();
    cy.url().should('include', '/register');
    cy.get('h1').should('contain', 'Registration');
  });
});
