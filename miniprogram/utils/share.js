// 分享文案集中在这里。不发金币、不写奖励，避免踩微信「滥用分享」红线。
// 落地页用登录页：新用户先看到注册，老用户登录页会自己跳首页。
const APP_NAME = '智卷错题通';
const LANDING = '/pages/login/login?from=share';

function inviteCard() {
  return {
    title: APP_NAME + '｜拍照就能整理错题，AI 自动分类组卷',
    path: LANDING
  };
}

function checkinCard(streak) {
  const n = Number(streak) || 0;
  return {
    title: n > 0
      ? '我在' + APP_NAME + '连续打卡 ' + n + ' 天，一起来整理错题'
      : APP_NAME + '｜每天打卡，把错题整理清楚',
    path: LANDING
  };
}

function boardCard(metric, me) {
  const rank = me && me.rank;
  const score = me && me.score;
  if (metric === 'questions') {
    return {
      title: rank
        ? '我在' + APP_NAME + '已整理 ' + score + ' 道错题，排第 ' + rank
        : APP_NAME + '｜AI 帮你把错题整理成册',
      path: LANDING
    };
  }
  return {
    title: rank
      ? '我在' + APP_NAME + '连续打卡排第 ' + rank + '，一起来坚持'
      : APP_NAME + '｜一起打卡整理错题',
    path: LANDING
  };
}

function timelineCard(title) {
  return { title: title || (APP_NAME + '｜拍照就能整理错题') };
}

function enableShareMenu() {
  if (typeof wx.showShareMenu !== 'function') return;
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
}

module.exports = {
  APP_NAME,
  LANDING,
  inviteCard,
  checkinCard,
  boardCard,
  timelineCard,
  enableShareMenu
};
