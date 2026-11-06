import { sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().unique(), email:text('email').notNull(),
  role:text('role',{enum:['student','faculty']}).notNull(), name:text('name').notNull(),
  institution:text('institution').notNull(), department:text('department').notNull(),
  bio:text('bio').notNull().default(''), interests:text('interests').notNull().default(''), createdAt:text('created_at').notNull()
});
export const research = sqliteTable('research', {
  id:text('id').primaryKey(), facultyId:text('faculty_id').notNull().references(()=>accounts.id),
  title:text('title').notNull(), description:text('description').notNull(), field:text('field').notNull(),
  skills:text('skills').notNull(), commitment:text('commitment').notNull(), location:text('location').notNull(),
  status:text('status',{enum:['open','closed']}).notNull().default('open'), createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('research_faculty').on(t.facultyId)]);
export const requests = sqliteTable('join_requests', {
  id:text('id').primaryKey(),researchId:text('research_id').notNull().references(()=>research.id),
  studentId:text('student_id').notNull().references(()=>accounts.id),message:text('message').notNull(),
  status:text('status',{enum:['pending','accepted','declined','withdrawn']}).notNull().default('pending'),
  createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('one_request_per_student').on(t.researchId,t.studentId),index('requests_student').on(t.studentId)]);
export const threads = sqliteTable('threads', {
  id:text('id').primaryKey(),studentId:text('student_id').notNull().references(()=>accounts.id),
  facultyId:text('faculty_id').notNull().references(()=>accounts.id),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('one_thread_per_pair').on(t.studentId,t.facultyId)]);
export const messages = sqliteTable('messages', {
  id:text('id').primaryKey(),threadId:text('thread_id').notNull().references(()=>threads.id),
  senderId:text('sender_id').notNull().references(()=>accounts.id),body:text('body').notNull(),createdAt:text('created_at').notNull()
},t=>[index('messages_thread_time').on(t.threadId,t.createdAt),index('messages_sender_time').on(t.senderId,t.createdAt)]);
