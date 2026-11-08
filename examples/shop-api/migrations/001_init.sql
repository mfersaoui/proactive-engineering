create table customers (id serial primary key, email text not null);
create table orders (id serial primary key, customer_id int references customers(id));
